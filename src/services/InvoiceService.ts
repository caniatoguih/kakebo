import { Prisma } from '@prisma/client';
import { getBillingCycleForDate } from '../domain/billing/billingCycle';
import { calculateBalanceImpactCents } from '../domain/finance/balanceImpact';
import { fromCents } from '../domain/finance/money';

type InvoiceTransactionInput = Prisma.TransacaoUncheckedCreateInput;

export function determineInvoiceStatus(input: {
  total: number;
  paid: number;
  closingDate: Date;
  dueDate: Date;
  now?: Date;
}): 'Aberta' | 'Fechada' | 'ParcialmentePaga' | 'Paga' | 'Vencida' {
  const now = input.now ?? new Date();
  if (input.total > 0 && input.paid >= input.total) return 'Paga';
  if (input.paid < input.total && input.dueDate < now) return 'Vencida';
  if (input.paid > 0 && input.paid < input.total) return 'ParcialmentePaga';
  return input.closingDate > now ? 'Aberta' : 'Fechada';
}

export class InvoiceService {
  async assignCardTransactions(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    cartaoId: string,
    closingDay: number,
    dueDay: number,
    transactions: InvoiceTransactionInput[],
  ): Promise<void> {
    const cycles = new Map<string, ReturnType<typeof getBillingCycleForDate>>();
    for (const transaction of transactions) {
      const cycle = getBillingCycleForDate(new Date(transaction.data_transacao), closingDay, dueDay);
      cycles.set(cycle.competence, cycle);
    }

    await tx.faturaCartao.createMany({
      data: [...cycles.values()].map((cycle) => ({
        usuario_id: usuarioId,
        cartao_id: cartaoId,
        competencia: cycle.competence,
        data_inicio: cycle.start,
        data_fim: cycle.end,
        data_fechamento: cycle.closingDate,
        data_vencimento: cycle.dueDate,
        status: cycle.closingDate <= new Date() ? 'Fechada' as const : 'Aberta' as const,
      })),
      skipDuplicates: true,
    });

    const invoices = await tx.faturaCartao.findMany({
      where: { cartao_id: cartaoId, competencia: { in: [...cycles.keys()] } },
      select: { id: true, competencia: true },
    });
    const invoiceByCompetence = new Map(invoices.map((invoice) => [invoice.competencia, invoice.id]));
    const groups = new Map<string, { invoiceId: string; totalCents: number }>();

    for (const transaction of transactions) {
      const cycle = getBillingCycleForDate(new Date(transaction.data_transacao), closingDay, dueDay);
      let group = groups.get(cycle.competence);
      if (!group) {
        const invoiceId = invoiceByCompetence.get(cycle.competence);
        if (!invoiceId) throw new Error(`Não foi possível preparar a fatura ${cycle.competence}.`);
        group = { invoiceId, totalCents: 0 };
        groups.set(cycle.competence, group);
      }

      transaction.fatura_id = group.invoiceId;
      group.totalCents += calculateBalanceImpactCents({
        accountType: 'CartaoCredito',
        transactionType: String(transaction.tipo),
        status: String(transaction.status),
        description: String(transaction.descricao),
        value: transaction.valor as any,
      });
    }

    const updates = [...groups.values()].filter((group) => group.totalCents !== 0);
    if (updates.length > 0) {
      const values = Prisma.join(updates.map((group) => Prisma.sql`(
        CAST(${group.invoiceId} AS text),
        CAST(${fromCents(group.totalCents)} AS numeric)
      )`));
      await tx.$executeRaw(Prisma.sql`
        UPDATE faturas_cartao AS invoice
        SET total = invoice.total + changes.delta
        FROM (VALUES ${values}) AS changes(id, delta)
        WHERE invoice.id = changes.id
      `);
    }
  }

  async refreshStatus(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
    const invoice = await tx.faturaCartao.findUniqueOrThrow({ where: { id: invoiceId } });
    const total = Number(invoice.total);
    const paid = Number(invoice.total_pago);
    const status = determineInvoiceStatus({
      total,
      paid,
      closingDate: invoice.data_fechamento,
      dueDate: invoice.data_vencimento,
    });
    await tx.faturaCartao.update({ where: { id: invoiceId }, data: { status } });
  }
}
