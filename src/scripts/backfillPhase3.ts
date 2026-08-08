import prisma from '../lib/prisma';
import { InvoiceService } from '../services/InvoiceService';
import { isLegacyInvoicePayment } from '../domain/billing/billingCycle';

async function backfillInvoices(): Promise<number> {
  const cards = await prisma.contaBancaria.findMany({
    where: { tipo: 'CartaoCredito' },
    include: { cartao_detalhe: true },
  });
  let linked = 0;

  for (const card of cards) {
    if (!card.cartao_detalhe) continue;
    const transactions = await prisma.transacao.findMany({
      where: {
        conta_id: card.id,
        fatura_id: null,
        NOT: { tipo: 'Transferencia' },
      },
    });
    if (transactions.length === 0) continue;

    await prisma.$transaction(async (tx) => {
      const inputs = transactions.map((transaction) => ({
        ...transaction,
        valor: transaction.valor,
      }));
      await new InvoiceService().assignCardTransactions(
        tx,
        card.usuario_id,
        card.id,
        card.cartao_detalhe!.dia_fechamento,
        card.cartao_detalhe!.dia_vencimento,
        inputs,
      );
      for (const input of inputs) {
        await tx.transacao.update({
          where: { id: input.id },
          data: { fatura_id: input.fatura_id },
        });
      }
    });
    linked += transactions.length;
  }
  return linked;
}

async function backfillTransfers(): Promise<number> {
  const transfers = await prisma.transacao.findMany({
    where: { tipo: 'Transferencia', transferencia_grupo_id: null },
    orderBy: [{ usuario_id: 'asc' }, { data_transacao: 'asc' }],
  });
  const consumed = new Set<string>();
  let groups = 0;

  for (const outgoing of transfers) {
    if (consumed.has(outgoing.id) || !outgoing.descricao.startsWith('[Saída]')) continue;
    const baseDescription = outgoing.descricao.replace(/^\[Saída\]\s*/, '');
    const matches = transfers.filter((candidate) =>
      !consumed.has(candidate.id)
      && candidate.id !== outgoing.id
      && candidate.usuario_id === outgoing.usuario_id
      && candidate.conta_id !== outgoing.conta_id
      && candidate.descricao.replace(/^\[Entrada\]\s*/, '') === baseDescription
      && candidate.descricao.startsWith('[Entrada]')
      && candidate.data_transacao.getTime() === outgoing.data_transacao.getTime()
      && candidate.valor.equals(outgoing.valor),
    );
    // Ambiguous historical pairs are intentionally left untouched for manual review.
    if (matches.length !== 1) continue;
    const incoming = matches[0];

    await prisma.$transaction(async (tx) => {
      const group = await tx.transferenciaGrupo.create({
        data: { usuario_id: outgoing.usuario_id, descricao: baseDescription },
      });
      await tx.transacao.update({
        where: { id: outgoing.id },
        data: { transferencia_grupo_id: group.id, transferencia_direcao: 'Saida' },
      });
      await tx.transacao.update({
        where: { id: incoming.id },
        data: { transferencia_grupo_id: group.id, transferencia_direcao: 'Entrada' },
      });
    });
    consumed.add(outgoing.id);
    consumed.add(incoming.id);
    groups += 1;
  }
  return groups;
}

async function backfillInvoicePayments(): Promise<number> {
  const groups = await prisma.transferenciaGrupo.findMany({
    include: { transacoes: { include: { conta: true } } },
  });
  let payments = 0;

  for (const group of groups) {
    if (group.transacoes.length !== 2) continue;
    const incoming = group.transacoes.find((transaction) =>
      transaction.transferencia_direcao === 'Entrada'
      && transaction.conta.tipo === 'CartaoCredito'
      && isLegacyInvoicePayment(transaction.descricao),
    );
    const outgoing = group.transacoes.find((transaction) => transaction.transferencia_direcao === 'Saida');
    if (!incoming || !outgoing) continue;
    const existing = await prisma.pagamentoFatura.findFirst({
      where: { OR: [{ transacao_saida_id: outgoing.id }, { transacao_entrada_id: incoming.id }] },
    });
    if (existing) continue;
    const invoice = await prisma.faturaCartao.findFirst({
      where: {
        cartao_id: incoming.conta_id,
        data_fechamento: { lte: incoming.data_transacao },
      },
      orderBy: { data_fechamento: 'desc' },
    });
    if (!invoice) continue;

    await prisma.$transaction(async (tx) => {
      await tx.pagamentoFatura.create({
        data: {
          usuario_id: incoming.usuario_id,
          fatura_id: invoice.id,
          valor: incoming.valor,
          data_pagamento: incoming.data_transacao,
          transacao_saida_id: outgoing.id,
          transacao_entrada_id: incoming.id,
        },
      });
      await tx.faturaCartao.update({
        where: { id: invoice.id },
        data: { total_pago: { increment: incoming.valor } },
      });
      await new InvoiceService().refreshStatus(tx, invoice.id);
    });
    payments += 1;
  }
  return payments;
}

async function main() {
  const invoices = await backfillInvoices();
  const transfers = await backfillTransfers();
  const payments = await backfillInvoicePayments();
  console.log(JSON.stringify({
    invoiceTransactionsLinked: invoices,
    transferGroupsCreated: transfers,
    invoicePaymentsLinked: payments,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
