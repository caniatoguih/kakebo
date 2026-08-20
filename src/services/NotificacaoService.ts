import prisma from '../lib/prisma';

export interface PaymentReminder {
  id: string;
  tipo: 'Despesa' | 'Fatura';
  descricao: string;
  conta_nome: string;
  valor: number;
  data_vencimento: string;
}

function getSaoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function getReminderWindow(days: number) {
  const { year, month, day } = getSaoPauloDateParts();
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days + 1);
  return { start, end };
}

export class NotificacaoService {
  async listarContasAPagar(usuarioId: string, dias: number): Promise<PaymentReminder[]> {
    const { start, end } = getReminderWindow(dias);
    const [despesas, faturas] = await Promise.all([
      prisma.transacao.findMany({
        where: {
          usuario_id: usuarioId,
          tipo: 'Despesa',
          status: 'Pendente',
          conta: { tipo: { not: 'CartaoCredito' } },
          data_transacao: { gte: start, lt: end },
        },
        orderBy: { data_transacao: 'asc' },
        select: { id: true, descricao: true, valor: true, data_transacao: true, conta: { select: { nome: true } } },
      }),
      prisma.faturaCartao.findMany({
        where: {
          usuario_id: usuarioId,
          status: { not: 'Paga' },
          data_vencimento: { gte: start, lt: end },
        },
        orderBy: { data_vencimento: 'asc' },
        select: { id: true, total: true, total_pago: true, data_vencimento: true, cartao: { select: { nome: true } } },
      }),
    ]);

    const lembretes: PaymentReminder[] = [
      ...despesas.map((despesa) => ({
        id: `despesa:${despesa.id}`,
        tipo: 'Despesa' as const,
        descricao: despesa.descricao,
        conta_nome: despesa.conta.nome,
        valor: Number(despesa.valor),
        data_vencimento: despesa.data_transacao.toISOString(),
      })),
      ...faturas
        .map((fatura) => ({ fatura, restante: Number(fatura.total) - Number(fatura.total_pago) }))
        .filter(({ restante }) => restante > 0)
        .map(({ fatura, restante }) => ({
          id: `fatura:${fatura.id}`,
          tipo: 'Fatura' as const,
          descricao: `Fatura ${fatura.cartao.nome}`,
          conta_nome: fatura.cartao.nome,
          valor: restante,
          data_vencimento: fatura.data_vencimento.toISOString(),
        })),
    ];

    return lembretes.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }
}
