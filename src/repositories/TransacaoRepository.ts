import prisma from '../lib/prisma';
import { Prisma, StatusTransacao } from '@prisma/client';

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
    subcategoria_id?: string;
    busca?: string;
    status?: 'Pago' | 'Pendente';
    inicio?: string;
    fim?: string;
    page: number;
    limit: number;
  }) {
    const { usuario_id, mes, ano, conta_id, subcategoria_id, busca, status, inicio, fim, page, limit } = filters;

    const where: Prisma.TransacaoWhereInput = {
      usuario_id,
      ...(status && { status }),
      ...(subcategoria_id && { subcategoria_id }),
      ...(busca && { descricao: { contains: busca, mode: 'insensitive' } }),
      AND: [
        { OR: [
          { tipo: { not: 'Transferencia' } },
          { transferencia_direcao: 'Saida' },
          { transferencia_direcao: null, descricao: { startsWith: '[Saída]' } },
        ] },
        ...(conta_id ? [{ OR: [
          { conta_id },
          { transferencia_grupo: { transacoes: { some: { conta_id } } } },
        ] }] : []),
      ],
    };

    if (mes && ano) {
      const start = new Date(Date.UTC(ano, mes - 1, 1));
      const end = new Date(Date.UTC(ano, mes, 1));
      (where.AND as Prisma.TransacaoWhereInput[]).push({
        OR: [
          {
            conta: { tipo: { not: 'CartaoCredito' } },
            data_transacao: { gte: start, lt: end },
          },
          {
            conta: { tipo: 'CartaoCredito' },
            fatura: { data_vencimento: { gte: start, lt: end } },
          },
          {
            conta: { tipo: 'CartaoCredito' },
            fatura_id: null,
            data_transacao: { gte: start, lt: end },
          },
        ],
      });
    } else if (inicio || fim) {
      (where.AND as Prisma.TransacaoWhereInput[]).push({
        data_transacao: {
          ...(inicio && { gte: new Date(`${inicio}T00:00:00.000Z`) }),
          ...(fim && { lte: new Date(`${fim}T23:59:59.999Z`) }),
        },
      });
    }

    const skip = (page - 1) * limit;
    const [total, transacoes] = await prisma.$transaction([
      prisma.transacao.count({ where }),
      prisma.transacao.findMany({
      where,
      orderBy: { data_transacao: 'desc' },
      skip,
      take: limit,
      include: {
        conta: true,
        transferencia_grupo: {
          select: {
            transacoes: {
              select: { id: true, conta_id: true, transferencia_direcao: true, conta: { select: { nome: true } } },
            },
          },
        },
        fatura: { select: { competencia: true, data_vencimento: true } },
        subcategoria: { select: { nome: true, categoria: { select: { pilar: true, nome: true } } } }
      }
    }),
    ]);

    return { transacoes, total };
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

  async updateStatus(id: string, status: StatusTransacao) {
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
