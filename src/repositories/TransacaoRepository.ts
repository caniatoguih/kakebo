import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';

function getPaymentMonthAndYear(dataTransacao: Date, diaFechamento: number): { month: number; year: number } {
  const d = new Date(dataTransacao);
  const day = d.getUTCDate();
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth(); // 0-indexed

  if (day >= diaFechamento) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  // O pagamento ocorre sempre no mês seguinte (+1 mês)
  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }

  return { month, year };
}

function isInvoicePayment(descricao: string): boolean {
  const descLower = (descricao || '').toLowerCase();
  return descLower.includes('pagamento fatura') || descLower.includes('liquidação fatura') || descLower.includes('liquidacao fatura');
}

export class TransacaoRepository {
  async create(data: Prisma.TransacaoUncheckedCreateInput) {
    return prisma.transacao.create({ data });
  }

  async createMany(data: Prisma.TransacaoUncheckedCreateInput[]) {
    return prisma.transacao.createMany({ data });
  }

  async findByFilters(filters: {
    usuario_id: string;
    mes?: number;
    ano?: number;
    conta_id?: string;
    page: number;
    limit: number;
  }) {
    const { usuario_id, mes, ano, conta_id, page, limit } = filters;

    const where: Prisma.TransacaoWhereInput = {
      usuario_id,
      ...(conta_id && { conta_id }),
    };

    // Buscamos todas as transações correspondentes para filtragem em memória do faturamento se mes/ano forem fornecidos
    const todasTransacoes = await prisma.transacao.findMany({
      where,
      orderBy: { data_transacao: 'desc' },
      include: {
        conta: {
          include: {
            cartao_detalhe: true
          }
        },
        subcategoria: { select: { nome: true, categoria: { select: { pilar: true, nome: true } } } }
      }
    });

    let transacoesFiltradas = todasTransacoes;

    if (mes && ano) {
      const targetMonthIndex = mes - 1; // 0-indexed
      
      transacoesFiltradas = todasTransacoes.filter(t => {
        if (t.conta?.tipo === 'CartaoCredito' && t.conta.cartao_detalhe && !isInvoicePayment(t.descricao)) {
          const diaFechamento = t.conta.cartao_detalhe.dia_fechamento;
          const { month, year } = getPaymentMonthAndYear(t.data_transacao, diaFechamento);
          return month === targetMonthIndex && year === ano;
        } else {
          const d = new Date(t.data_transacao);
          const tMes = d.getUTCMonth();
          const tAno = d.getUTCFullYear();
          return tMes === targetMonthIndex && tAno === ano;
        }
      });
    }

    const total = transacoesFiltradas.length;
    const skip = (page - 1) * limit;
    const transacoesPaginated = transacoesFiltradas.slice(skip, skip + limit);

    return { transacoes: transacoesPaginated, total };
  }

  async findPendentesByConta(usuario_id: string, conta_id: string) {
    return prisma.transacao.findMany({
      where: {
        usuario_id,
        conta_id,
        status: 'Pendente'
      }
    });
  }

  async updateStatus(id: string, status: string) {
    return prisma.transacao.update({
      where: { id },
      data: { status }
    });
  }

  async findById(id: string) {
    return prisma.transacao.findUnique({
      where: { id }
    });
  }
}
