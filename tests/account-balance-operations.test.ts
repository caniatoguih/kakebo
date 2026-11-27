import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    transacao: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contaBancaria: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    transferenciaGrupo: { create: vi.fn() },
    auditoriaFinanceira: { create: vi.fn() },
  };
  return {
    tx, transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    accountOwnership: vi.fn(), accountFindUnique: vi.fn(), transactionFindMany: vi.fn(),
    transactionFindUnique: vi.fn(), transactionFindFirst: vi.fn(),
  };
});
vi.mock('../src/lib/prisma', () => ({ default: {
  $transaction: mocks.transaction,
  contaBancaria: { findUnique: mocks.accountFindUnique },
  transacao: { findMany: mocks.transactionFindMany, findUnique: mocks.transactionFindUnique, findFirst: mocks.transactionFindFirst },
} }));
vi.mock('../src/services/OwnershipService', () => ({
  assertAccountOwnership: mocks.accountOwnership, assertSubcategoryOwnership: vi.fn(),
}));
// Estes testes cobrem movimentação de saldos; composição de faturas tem sua própria suíte.
vi.mock('../src/services/InvoiceService', () => ({ InvoiceService: class {} }));

import { TransacaoService } from '../src/services/TransacaoService';
import { calculateAccountBalanceCents } from '../src/domain/finance/balanceImpact';
import { fromCents, toCents } from '../src/domain/finance/money';

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lancamento-1', usuario_id: 'usuario-1', conta_id: 'conta-1', tipo: 'Despesa',
    status: 'Pendente', descricao: 'Compra', valor: 45.9,
    data_transacao: new Date('2026-07-01T12:00:00.000Z'),
    recorrente: false, parcela_atual: 1, conta: { id: 'conta-1', tipo: 'Corrente' },
    pagamento_fatura_saida: null, pagamento_fatura_entrada: null,
    ...overrides,
  };
}

function ledger(items: ReturnType<typeof transaction>[], balances: [number, number]) {
  const accounts = new Map([
    ['conta-1', { id: 'conta-1', usuario_id: 'usuario-1', tipo: 'Corrente', saldo_inicial: 100, saldo_atual: balances[0] }],
    ['conta-2', { id: 'conta-2', usuario_id: 'usuario-1', tipo: 'Poupanca', saldo_inicial: 50, saldo_atual: balances[1] }],
  ]);
  const transactions = new Map(items.map((item) => [item.id, item]));
  mocks.tx.contaBancaria.findUnique.mockImplementation(async ({ where }: any) => accounts.get(where.id));
  mocks.accountFindUnique.mockImplementation(async ({ where }: any) => accounts.get(where.id));
  mocks.transactionFindMany.mockImplementation(async ({ where }: any) => [...transactions.values()].filter((item) => item.conta_id === where.conta_id));
  mocks.accountOwnership.mockImplementation(async (id: string) => accounts.get(id));
  mocks.tx.contaBancaria.update.mockImplementation(async ({ where, data }: any) => {
    const account = accounts.get(where.id)!;
    account.saldo_atual = fromCents(toCents(account.saldo_atual)
      + toCents(data.saldo_atual.increment ?? 0) - toCents(data.saldo_atual.decrement ?? 0));
    return account;
  });
  mocks.tx.transacao.findUnique.mockImplementation(async ({ where }: any) => {
    const item = transactions.get(where.id)!;
    return { ...item, conta: accounts.get(item.conta_id) };
  });
  mocks.tx.transacao.findFirst.mockImplementation(async ({ where }: any) => {
    const item = typeof where.id === 'string' ? transactions.get(where.id)
      : [...transactions.values()].find((item) => item.id !== where.id.not && item.descricao === where.descricao);
    return item ? { ...item, conta: accounts.get(item.conta_id) } : null;
  });
  mocks.tx.transacao.update.mockImplementation(async ({ where, data }: any) => {
    const item = { ...transactions.get(where.id)!, ...data };
    transactions.set(item.id, item);
    return item;
  });
  mocks.tx.transacao.create.mockImplementation(async ({ data }: any) => {
    const item = { ...data, id: data.id ?? 'nova-entrada' };
    transactions.set(item.id, item);
    return item;
  });
  mocks.tx.transacao.delete.mockImplementation(async ({ where }: any) => transactions.delete(where.id));
  return {
    transactions,
    expectBalances(expected: [number, number]) {
      expect([...accounts.values()].map((account) => account.saldo_atual)).toEqual(expected);
      for (const account of accounts.values()) {
        const recalculated = calculateAccountBalanceCents(account.tipo, account.saldo_inicial,
          [...transactions.values()].filter((item) => item.conta_id === account.id));
        expect(toCents(account.saldo_atual)).toBe(recalculated);
      }
    },
  };
}

describe('consistência dos saldos nas movimentações', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.accountOwnership.mockResolvedValue({ id: 'conta-2', tipo: 'Corrente' });
    mocks.tx.transacao.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
    mocks.tx.transacao.create.mockResolvedValue({ id: 'saida-1' });
    mocks.tx.contaBancaria.update.mockResolvedValue({});
    mocks.tx.transferenciaGrupo.create.mockResolvedValue({ id: 'grupo-1' });
    mocks.tx.auditoriaFinanceira.create.mockResolvedValue({});
  });
  afterEach(() => vi.useRealTimers());

  it('transforma receita recebida em transferência com saída e entrada equivalentes', async () => {
    const receipt = transaction({ tipo: 'Receita', status: 'Pago' });
    const state = ledger([receipt], [145.9, 50]);
    await new TransacaoService().editarTransacao(receipt.id, {
      conta_id: 'conta-1', conta_destino_id: 'conta-2', descricao: 'Reserva', valor: 45.9,
      tipo: 'Transferencia', status: 'Pago', data_transacao: receipt.data_transacao.toISOString(),
    }, 'usuario-1');
    state.expectBalances([54.1, 95.9]);
    expect(state.transactions.size).toBe(2);
  });

  it('transforma transferência legada em despesa e estorna a entrada antiga', async () => {
    const source = transaction({ tipo: 'Transferencia', status: 'Pago', descricao: '[Saída] Reserva' });
    const destination = transaction({ id: 'entrada', conta_id: 'conta-2', tipo: 'Transferencia', status: 'Pago', descricao: '[Entrada] Reserva' });
    const state = ledger([source, destination], [54.1, 95.9]);
    await new TransacaoService().editarTransacao(source.id, {
      conta_id: 'conta-1', descricao: 'Mercado', valor: 30,
      tipo: 'Despesa', status: 'Pago', data_transacao: source.data_transacao.toISOString(),
    }, 'usuario-1');
    state.expectBalances([70, 50]);
    expect(state.transactions.size).toBe(1);
  });

  it('exclui as duas pontas de transferência legada sem perder caracteres da descrição', async () => {
    const source = transaction({ tipo: 'Transferencia', status: 'Pago', descricao: '[Saída] Reserva' });
    const destination = transaction({ id: 'entrada', conta_id: 'conta-2', tipo: 'Transferencia', status: 'Pago', descricao: '[Entrada] Reserva' });
    const state = ledger([source, destination], [54.1, 95.9]);
    await new TransacaoService().deletarTransacao(source.id, 'usuario-1');
    state.expectBalances([100, 50]);
    expect(state.transactions.size).toBe(0);
  });

  it('concilia os dois lados de transferência e não movimenta saldo ao repetir o extrato', async () => {
    const source = transaction({ tipo: 'Transferencia', descricao: '[Saída] Reserva' });
    const destination = transaction({ id: 'entrada', conta_id: 'conta-2', tipo: 'Transferencia', descricao: '[Entrada] Reserva' });
    const state = ledger([source, destination], [100, 50]);
    const ofx = '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260701<TRNAMT>-45.90<MEMO>Reserva</STMTTRN>';
    const service = new TransacaoService();
    await service.conciliarOFX('usuario-1', 'conta-1', ofx);
    state.expectBalances([54.1, 95.9]);
    expect([...state.transactions.values()].map((item) => item.status)).toEqual(['Pago', 'Pago']);
    await service.conciliarOFX('usuario-1', 'conta-1', ofx);
    state.expectBalances([54.1, 95.9]);
    expect(mocks.tx.contaBancaria.update).toHaveBeenCalledTimes(2);
  });

  it.each(['Pago', 'Pendente'])('altera as duas pontas da transferência a partir de %s', async (status) => {
    const source = transaction({ tipo: 'Transferencia', status, transferencia_grupo_id: 'grupo-1', transferencia_direcao: 'Saida', descricao: 'Reserva' });
    const destination = transaction({
      id: 'lancamento-2', conta_id: 'conta-2', tipo: 'Transferencia', status,
      transferencia_grupo_id: 'grupo-1', transferencia_direcao: 'Entrada', descricao: 'Reserva',
      conta: { id: 'conta-2', tipo: 'Poupanca' },
    });
    mocks.tx.transacao.findFirst.mockResolvedValueOnce(source).mockResolvedValueOnce(destination);

    await new TransacaoService().toggleStatus(source.id, 'usuario-1');

    const nextStatus = status === 'Pago' ? 'Pendente' : 'Pago';
    expect(mocks.tx.transacao.update).toHaveBeenCalledWith({ where: { id: source.id }, data: { status: nextStatus } });
    expect(mocks.tx.transacao.update).toHaveBeenCalledWith({ where: { id: destination.id }, data: { status: nextStatus } });
    expect(mocks.tx.contaBancaria.update).toHaveBeenCalledWith({
      where: { id: 'conta-1' }, data: { saldo_atual: { increment: status === 'Pago' ? 45.9 : -45.9 } },
    });
    expect(mocks.tx.contaBancaria.update).toHaveBeenCalledWith({
      where: { id: 'conta-2' }, data: { saldo_atual: { increment: status === 'Pago' ? -45.9 : 45.9 } },
    });
  });

  it('impede alteração de status de pagamento de fatura sem estorno', async () => {
    mocks.tx.transacao.findFirst.mockResolvedValue(transaction({ status: 'Pago', pagamento_fatura_saida: { id: 'pagamento-1' } }));
    await expect(new TransacaoService().toggleStatus('lancamento-1', 'usuario-1')).rejects.toThrow('estornados individualmente');
    expect(mocks.tx.transacao.update).not.toHaveBeenCalled();
    expect(mocks.tx.contaBancaria.update).not.toHaveBeenCalled();
  });

  it.each([false, true])('concilia compra de cartão recorrente=%s sem perder nem duplicar dívida', async (recorrente) => {
    const pending = transaction({ recorrente, parcela_atual: 2, conta: { id: 'conta-1', tipo: 'CartaoCredito' } });
    mocks.accountFindUnique.mockResolvedValue({ id: 'conta-1', usuario_id: 'usuario-1', tipo: 'CartaoCredito' });
    mocks.transactionFindMany.mockResolvedValue([pending]);
    mocks.tx.transacao.findFirst.mockResolvedValue(pending);

    const result = await new TransacaoService().conciliarOFX('usuario-1', 'conta-1', `
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260701<TRNAMT>-45.90<MEMO>Compra</STMTTRN>
    `);

    expect(result.conciliadasCount).toBe(1);
    expect(mocks.tx.transacao.update).toHaveBeenCalledWith({ where: { id: pending.id }, data: { status: 'Pago' } });
    if (recorrente) {
      expect(mocks.tx.contaBancaria.update).toHaveBeenCalledWith({ where: { id: 'conta-1' }, data: { saldo_atual: { increment: 45.9 } } });
    } else {
      expect(mocks.tx.contaBancaria.update).not.toHaveBeenCalled();
    }
  });

  it('converte receita pendente do cartão sem contabilizar o crédito duas vezes', async () => {
    const receipt = transaction({ tipo: 'Receita', conta: { id: 'conta-1', tipo: 'CartaoCredito' } });
    mocks.tx.transacao.findUnique.mockResolvedValue(receipt);
    mocks.tx.contaBancaria.findUnique.mockResolvedValue({ id: 'conta-2', usuario_id: 'usuario-1', tipo: 'Corrente' });
    mocks.tx.transacao.create.mockResolvedValue({ id: 'saida-1' });

    await new TransacaoService().converterParaTransferencia('usuario-1', 'conta-2', receipt.id, 'Pagamento', receipt.data_transacao, 45.9);

    expect(mocks.tx.contaBancaria.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'conta-2' }, data: { saldo_atual: { increment: -45.9 } },
    });
  });

  it('rejeita conversão com valor diferente da receita', async () => {
    mocks.tx.transacao.findUnique.mockResolvedValue(transaction({ tipo: 'Receita' }));
    await expect(new TransacaoService().converterParaTransferencia('usuario-1', 'conta-2', 'lancamento-1', 'PIX', new Date(), 90))
      .rejects.toThrow('igual ao da receita');
    expect(mocks.tx.transacao.create).not.toHaveBeenCalled();
  });

  it.each([null, 'conta-2'])('fechamento legado preserva outras dívidas com conta de pagamento %s', async (contaPagamento) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
    mocks.tx.contaBancaria.findFirst.mockResolvedValue({
      id: 'conta-1', nome: 'Cartão', tipo: 'CartaoCredito',
      cartao_detalhe: { dia_fechamento: 10, dia_vencimento: 17, conta_pagamento_padrao_id: contaPagamento },
    });
    mocks.tx.transacao.findMany.mockResolvedValue([
      transaction({ valor: 100 }),
      transaction({ id: 'futura', valor: 200, data_transacao: new Date('2099-01-01T12:00:00Z') }),
    ]);

    await new TransacaoService().fecharFatura('usuario-1', 'conta-1');

    expect(mocks.tx.transacao.update).toHaveBeenCalledExactlyOnceWith({ where: { id: 'lancamento-1' }, data: { status: 'Pago' } });
    if (contaPagamento) {
      expect(mocks.tx.contaBancaria.update).toHaveBeenCalledWith({ where: { id: 'conta-1' }, data: { saldo_atual: { decrement: 100 } } });
    } else {
      expect(mocks.tx.contaBancaria.update).not.toHaveBeenCalled();
    }
  });

});
