import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import prisma from '../lib/prisma';
import { getBillingCycleForDate } from '../domain/billing/billingCycle';
import { calculateBalanceImpactCents } from '../domain/finance/balanceImpact';
import { fromCents, toCents } from '../domain/finance/money';
import { InvoiceService } from './InvoiceService';
import { recordFinancialAudit } from './AuditService';

const recurrenceInclude = {
  conta: { include: { cartao_detalhe: true } },
  fatura: {
    select: {
      competencia: true, status: true, total_pago: true,
      data_fechamento: true, data_vencimento: true,
    },
  },
  subcategoria: { select: { id: true, nome: true, categoria: { select: { nome: true } } } },
} satisfies Prisma.TransacaoInclude;

type RecurrenceTransaction = Prisma.TransacaoGetPayload<{ include: typeof recurrenceInclude }>;
type RecurrenceState = 'Ativa' | 'Encerrada' | 'Inconsistente';
type ChangeScope = 'SomenteCompetencia' | 'DestaCompetenciaEmDiante';

interface ChangeInput {
  novo_valor: number;
  competencia_inicial: string;
  escopo: ChangeScope;
}

export class RecurrenceOperationError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

function monthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function competenceOf(transaction: RecurrenceTransaction): string {
  if (transaction.conta.tipo !== 'CartaoCredito') return monthOf(transaction.data_transacao);
  if (transaction.fatura?.competencia) return transaction.fatura.competencia;
  const details = transaction.conta.cartao_detalhe;
  if (!details) return monthOf(transaction.data_transacao);
  return getBillingCycleForDate(
    transaction.data_transacao,
    details.dia_fechamento,
    details.dia_vencimento,
  ).competence;
}

function descriptionOf(transaction: RecurrenceTransaction): string {
  return transaction.descricao.replace(/^\[(?:Saída|Entrada)\]\s*/, '');
}

function startOfCurrentMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function invoiceImpactCents(transaction: { tipo: string; descricao: string; valor: unknown }): number {
  const value = toCents(transaction.valor as any);
  if (transaction.tipo === 'Despesa') return value;
  if (transaction.tipo === 'Receita') return -value;
  if (transaction.tipo === 'Transferencia') {
    return transaction.descricao.includes('[Saída]') ? value : -value;
  }
  return 0;
}

function logicalKey(transaction: RecurrenceTransaction): string {
  return `${competenceOf(transaction)}:${transaction.parcela_atual}`;
}

function buildChangeSimulation(transactions: RecurrenceTransaction[], input: ChangeInput) {
  const targets = transactions.filter((transaction) => {
    const competence = competenceOf(transaction);
    return input.escopo === 'SomenteCompetencia'
      ? competence === input.competencia_inicial
      : competence >= input.competencia_inicial;
  });
  const blocked = new Map<string, { competencia: string; motivo: string }>();
  const closedInvoices = new Map<string, { id: string; competencia: string; status: string }>();
  const invoiceIds = new Set<string>();
  const accountIds = new Set<string>();

  for (const transaction of targets) {
    const competence = competenceOf(transaction);
    accountIds.add(transaction.conta_id);
    if (transaction.fatura_id) invoiceIds.add(transaction.fatura_id);
    if (transaction.conta.tipo !== 'CartaoCredito' && transaction.status === 'Pago') {
      blocked.set(`${competence}:lancamento-pago`, { competencia: competence, motivo: 'Lançamento já pago.' });
    }
    const invoice = transaction.fatura;
    if (invoice && (invoice.status === 'Paga' || invoice.status === 'ParcialmentePaga' || Number(invoice.total_pago) > 0)) {
      blocked.set(`${competence}:fatura-paga`, { competencia: competence, motivo: 'Fatura paga ou parcialmente paga.' });
    } else if (invoice && (invoice.status === 'Fechada' || invoice.status === 'Vencida') && transaction.fatura_id) {
      closedInvoices.set(transaction.fatura_id, {
        id: transaction.fatura_id, competencia: invoice.competencia, status: invoice.status,
      });
    } else if (!invoice && transaction.conta.tipo === 'CartaoCredito' && transaction.status === 'Pago') {
      blocked.set(`${competence}:cartao-legado-pago`, {
        competencia: competence, motivo: 'Lançamento legado do cartão já está pago.',
      });
    }
  }

  if (transactions[0]?.tipo === 'Transferencia') {
    const byOccurrence = new Map<string, RecurrenceTransaction[]>();
    for (const transaction of targets) {
      const key = logicalKey(transaction);
      const group = byOccurrence.get(key) ?? [];
      group.push(transaction);
      byOccurrence.set(key, group);
    }
    for (const [key, group] of byOccurrence) {
      if (group.length !== 2
        || !group.some((item) => item.transferencia_direcao === 'Saida')
        || !group.some((item) => item.transferencia_direcao === 'Entrada')) {
        const competence = key.slice(0, 7);
        blocked.set(`${competence}:transferencia`, {
          competencia: competence, motivo: 'Transferência sem as duas pontas correspondentes.',
        });
      }
    }
  }

  const representatives = transactions[0]?.tipo === 'Transferencia'
    ? targets.filter((transaction) => transaction.transferencia_direcao === 'Saida')
    : targets;
  const newValueCents = toCents(input.novo_valor);
  const differenceCents = representatives.reduce(
    (sum, transaction) => sum + newValueCents - toCents(transaction.valor),
    0,
  );
  const fingerprint = targets
    .map((transaction) => [
      transaction.id, transaction.valor.toString(), transaction.status,
      transaction.fatura_id ?? '', transaction.fatura?.status ?? '',
      transaction.fatura?.total_pago?.toString() ?? '',
    ].join(':'))
    .sort();
  const simulationId = createHash('sha256').update(JSON.stringify({ input, fingerprint })).digest('hex');

  return {
    simulacao_id: simulationId,
    serie_id: transactions[0]?.transacao_pai_id,
    valor_atual: representatives[0] ? Number(representatives[0].valor) : null,
    novo_valor: fromCents(newValueCents),
    competencia_inicial: input.competencia_inicial,
    escopo: input.escopo,
    ocorrencias_afetadas: new Set(representatives.map(logicalKey)).size,
    lancamentos_afetados: targets.length,
    diferenca_total: fromCents(differenceCents),
    contas_afetadas: [...accountIds],
    faturas_afetadas: [...invoiceIds],
    faturas_fechadas: [...closedInvoices.values()],
    competencias_bloqueadas: [...blocked.values()].sort((a, b) => a.competencia.localeCompare(b.competencia)),
    requer_confirmacao_fatura_fechada: closedInvoices.size > 0,
    pode_executar: targets.length > 0 && blocked.size === 0,
    targetIds: targets.map((transaction) => transaction.id),
  };
}

export function summarizeRecurrence(transactions: RecurrenceTransaction[], now = new Date()) {
  if (transactions.length === 0 || !transactions[0].transacao_pai_id) {
    throw new Error('Série recorrente inválida.');
  }
  const ordered = [...transactions].sort((a, b) =>
    a.data_transacao.getTime() - b.data_transacao.getTime()
    || a.parcela_atual - b.parcela_atual,
  );
  const representativeTransactions = ordered[0].tipo === 'Transferencia'
    ? ordered.filter((transaction) => transaction.transferencia_direcao === 'Saida'
      || (!transaction.transferencia_direcao && transaction.descricao.startsWith('[Saída]')))
    : ordered;
  const representatives = representativeTransactions.length > 0 ? representativeTransactions : ordered;
  const transferGroups = new Map<number, RecurrenceTransaction[]>();
  if (ordered[0].tipo === 'Transferencia') {
    for (const transaction of ordered) {
      const group = transferGroups.get(transaction.parcela_atual) ?? [];
      group.push(transaction);
      transferGroups.set(transaction.parcela_atual, group);
    }
  }
  const inconsistent = ordered[0].tipo === 'Transferencia' && [...transferGroups.values()].some((group) =>
    group.length !== 2
    || !group.some((item) => item.transferencia_direcao === 'Saida')
    || !group.some((item) => item.transferencia_direcao === 'Entrada'),
  );
  const currentMonth = startOfCurrentMonth(now);
  const next = representatives.find((transaction) => transaction.data_transacao >= currentMonth);
  const current = next ?? representatives[representatives.length - 1];
  const source = ordered.find((transaction) => transaction.transferencia_direcao === 'Saida') ?? current;
  const destination = ordered.find((transaction) => transaction.transferencia_direcao === 'Entrada');
  const situacao: RecurrenceState = inconsistent
    ? 'Inconsistente'
    : next ? 'Ativa' : 'Encerrada';

  return {
    id: ordered[0].transacao_pai_id,
    descricao: descriptionOf(current),
    tipo: current.tipo,
    valor_atual: Number(current.valor),
    situacao,
    conta_origem: { id: source.conta.id, nome: source.conta.nome, tipo: source.conta.tipo },
    conta_destino: destination
      ? { id: destination.conta.id, nome: destination.conta.nome, tipo: destination.conta.tipo }
      : null,
    subcategoria: current.subcategoria
      ? { id: current.subcategoria.id, nome: current.subcategoria.nome, categoria: current.subcategoria.categoria.nome }
      : null,
    primeira_competencia: competenceOf(representatives[0]),
    proxima_competencia: next ? competenceOf(next) : null,
    ultima_competencia: competenceOf(representatives[representatives.length - 1]),
    ocorrencias_geradas: representatives.length,
    total_previsto: representatives.reduce((sum, transaction) => sum + Number(transaction.valor), 0),
  };
}

export class RecorrenciaService {
  private invoiceService = new InvoiceService();

  private findSeries(client: typeof prisma | Prisma.TransactionClient, usuarioId: string, id: string) {
    return client.transacao.findMany({
      where: { usuario_id: usuarioId, transacao_pai_id: id, recorrente: true },
      include: recurrenceInclude,
      orderBy: [{ data_transacao: 'asc' as const }, { parcela_atual: 'asc' as const }],
    });
  }

  async list(usuarioId: string, filters: {
    busca?: string;
    tipo?: 'Receita' | 'Despesa' | 'Transferencia';
    conta_id?: string;
    situacao?: RecurrenceState;
    page: number;
    limit: number;
  }) {
    let parentIdsForAccount: string[] | undefined;
    if (filters.conta_id) {
      const matching = await prisma.transacao.findMany({
        where: {
          usuario_id: usuarioId,
          recorrente: true,
          transacao_pai_id: { not: null },
          conta_id: filters.conta_id,
        },
        distinct: ['transacao_pai_id'],
        select: { transacao_pai_id: true },
      });
      parentIdsForAccount = matching.flatMap((item) => item.transacao_pai_id ? [item.transacao_pai_id] : []);
    }
    const where: Prisma.TransacaoWhereInput = {
      usuario_id: usuarioId,
      recorrente: true,
      transacao_pai_id: parentIdsForAccount
        ? { in: parentIdsForAccount }
        : { not: null },
      ...(filters.busca && { descricao: { contains: filters.busca, mode: 'insensitive' } }),
      ...(filters.tipo && { tipo: filters.tipo }),
    };
    const transactions = await prisma.transacao.findMany({
      where,
      include: recurrenceInclude,
      orderBy: [{ transacao_pai_id: 'asc' }, { data_transacao: 'asc' }, { parcela_atual: 'asc' }],
    });
    const grouped = new Map<string, RecurrenceTransaction[]>();
    for (const transaction of transactions) {
      if (!transaction.transacao_pai_id) continue;
      const group = grouped.get(transaction.transacao_pai_id) ?? [];
      group.push(transaction);
      grouped.set(transaction.transacao_pai_id, group);
    }
    const all = [...grouped.values()]
      .map((group) => summarizeRecurrence(group))
      .filter((item) => !filters.situacao || item.situacao === filters.situacao)
      .sort((a, b) => {
        if (!a.proxima_competencia) return 1;
        if (!b.proxima_competencia) return -1;
        return a.proxima_competencia.localeCompare(b.proxima_competencia)
          || a.descricao.localeCompare(b.descricao, 'pt-BR');
      });
    const start = (filters.page - 1) * filters.limit;
    return {
      recorrencias: all.slice(start, start + filters.limit),
      total: all.length,
      page: filters.page,
      limit: filters.limit,
      total_pages: Math.ceil(all.length / filters.limit),
    };
  }

  async detail(usuarioId: string, id: string) {
    const transactions = await this.findSeries(prisma, usuarioId, id);
    if (transactions.length === 0) return null;
    const auditEvents = await prisma.auditoriaFinanceira.findMany({
      where: {
        usuario_id: usuarioId,
        entidade: 'Transacao',
        entidade_id: id,
        acao: { in: ['CRIAR_RECORRENCIA', 'CRIAR_TRANSFERENCIA_RECORRENTE', 'ALTERAR_VALOR_RECORRENCIA'] },
      },
      select: {
        id: true, acao: true, dados: true, data_criacao: true, request_id: true,
      },
      orderBy: { data_criacao: 'desc' },
      take: 50,
    });
    return {
      ...summarizeRecurrence(transactions),
      ocorrencias: transactions.map((transaction) => ({
        id: transaction.id,
        competencia: competenceOf(transaction),
        data_transacao: transaction.data_transacao,
        valor: Number(transaction.valor),
        status: transaction.status,
        parcela_atual: transaction.parcela_atual,
        total_parcelas: transaction.total_parcelas,
        fatura_id: transaction.fatura_id,
        conta: { id: transaction.conta.id, nome: transaction.conta.nome, tipo: transaction.conta.tipo },
        transferencia_grupo_id: transaction.transferencia_grupo_id,
        transferencia_direcao: transaction.transferencia_direcao,
      })),
      historico: auditEvents,
    };
  }

  async simulateChange(usuarioId: string, id: string, input: ChangeInput) {
    const transactions = await this.findSeries(prisma, usuarioId, id);
    if (transactions.length === 0) return null;
    const simulation = buildChangeSimulation(transactions, input);
    const { targetIds: _targetIds, ...response } = simulation;
    return response;
  }

  async executeChange(usuarioId: string, id: string, input: ChangeInput & {
    simulacao_id: string;
    confirmar_faturas_fechadas: boolean;
  }) {
    const changeInput: ChangeInput = {
      novo_valor: input.novo_valor,
      competencia_inicial: input.competencia_inicial,
      escopo: input.escopo,
    };
    return prisma.$transaction(async (tx) => {
      const transactions = await this.findSeries(tx, usuarioId, id);
      if (transactions.length === 0) throw new RecurrenceOperationError('Recorrência não encontrada.', 404);
      const simulation = buildChangeSimulation(transactions, changeInput);
      if (simulation.simulacao_id !== input.simulacao_id) {
        throw new RecurrenceOperationError('A recorrência mudou desde a simulação. Gere uma nova prévia.', 409);
      }
      if (simulation.targetIds.length === 0) {
        throw new RecurrenceOperationError('Nenhuma ocorrência encontrada a partir da competência informada.', 400);
      }
      if (!simulation.pode_executar) {
        throw new RecurrenceOperationError('Existem competências protegidas que impedem a alteração.', 409);
      }
      if (simulation.requer_confirmacao_fatura_fechada && !input.confirmar_faturas_fechadas) {
        throw new RecurrenceOperationError('Confirme explicitamente a alteração das faturas fechadas.', 409);
      }

      const targetSet = new Set(simulation.targetIds);
      const targets = transactions.filter((transaction) => targetSet.has(transaction.id));
      const accountDeltas = new Map<string, number>();
      for (const transaction of targets) {
        const oldImpact = calculateBalanceImpactCents({
          accountType: transaction.conta.tipo, transactionType: transaction.tipo,
          status: transaction.status, description: transaction.descricao, value: transaction.valor,
          recurring: transaction.recorrente, installmentNumber: transaction.parcela_atual,
        });
        const newImpact = calculateBalanceImpactCents({
          accountType: transaction.conta.tipo, transactionType: transaction.tipo,
          status: transaction.status, description: transaction.descricao, value: input.novo_valor,
          recurring: transaction.recorrente, installmentNumber: transaction.parcela_atual,
        });
        accountDeltas.set(transaction.conta_id, (accountDeltas.get(transaction.conta_id) ?? 0) + newImpact - oldImpact);
      }

      await tx.transacao.updateMany({
        where: { id: { in: simulation.targetIds }, usuario_id: usuarioId },
        data: { valor: fromCents(toCents(input.novo_valor)) },
      });
      for (const [accountId, deltaCents] of accountDeltas) {
        if (deltaCents !== 0) await tx.contaBancaria.update({
          where: { id: accountId }, data: { saldo_atual: { increment: fromCents(deltaCents) } },
        });
      }

      for (const invoiceId of simulation.faturas_afetadas) {
        const invoiceTransactions = await tx.transacao.findMany({ where: { fatura_id: invoiceId } });
        const totalCents = invoiceTransactions.reduce((sum, transaction) => sum + invoiceImpactCents(transaction), 0);
        await tx.faturaCartao.update({ where: { id: invoiceId }, data: { total: fromCents(totalCents) } });
        await this.invoiceService.refreshStatus(tx, invoiceId);
      }
      await recordFinancialAudit(tx, {
        usuarioId, action: 'ALTERAR_VALOR_RECORRENCIA', entity: 'Transacao', entityId: id,
        data: {
          competencia_inicial: input.competencia_inicial, escopo: input.escopo,
          novo_valor: fromCents(toCents(input.novo_valor)),
          valores_anteriores: targets.map((transaction) => ({
            transacao_id: transaction.id,
            competencia: competenceOf(transaction),
            valor: Number(transaction.valor),
          })),
          lancamentos_afetados: simulation.targetIds,
          faturas_afetadas: simulation.faturas_afetadas,
        },
      });
      return {
        message: 'Valor da recorrência atualizado com sucesso.',
        ocorrencias_afetadas: simulation.ocorrencias_afetadas,
        lancamentos_afetados: simulation.targetIds.length,
        faturas_recalculadas: simulation.faturas_afetadas.length,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
