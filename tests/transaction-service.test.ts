import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    transacao: { create: vi.fn(), createMany: vi.fn() },
    transferenciaGrupo: { create: vi.fn() },
    contaBancaria: { update: vi.fn() },
    faturaCartao: { createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auditoriaFinanceira: { create: vi.fn() },
    $executeRaw: vi.fn(),
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    accountOwnership: vi.fn(),
    subcategoryOwnership: vi.fn(),
  };
});

vi.mock('../src/lib/prisma', () => ({
  default: {
    $transaction: mocks.transaction,
    cartaoCreditoDetalhe: { findUnique: vi.fn().mockResolvedValue({ dia_fechamento: 10, dia_vencimento: 17 }) },
  },
}));

vi.mock('../src/services/OwnershipService', () => ({
  assertAccountOwnership: mocks.accountOwnership,
  assertSubcategoryOwnership: mocks.subcategoryOwnership,
}));

import { TransacaoService } from '../src/services/TransacaoService';

describe('criação financeira atômica', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountOwnership.mockResolvedValue({ id: 'conta-1', tipo: 'CartaoCredito' });
    mocks.subcategoryOwnership.mockResolvedValue(null);
    mocks.tx.transacao.createMany.mockResolvedValue({ count: 3 });
    mocks.tx.contaBancaria.update.mockResolvedValue({});
    mocks.tx.faturaCartao.createMany.mockResolvedValue({ count: 3 });
    mocks.tx.faturaCartao.findMany.mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111', competencia: '2025-02' },
      { id: '22222222-2222-4222-8222-222222222222', competencia: '2025-03' },
      { id: '33333333-3333-4333-8333-333333333333', competencia: '2025-04' },
    ]);
    mocks.tx.faturaCartao.update.mockResolvedValue({});
    mocks.tx.$executeRaw.mockResolvedValue(3);
    mocks.tx.auditoriaFinanceira.create.mockResolvedValue({});
    mocks.tx.transferenciaGrupo.create.mockResolvedValue({ id: 'grupo-1' });
  });

  it('cria parcelas exatas e atualiza o saldo na mesma transação', async () => {
    const service = new TransacaoService();
    await service.criarTransacao({
      conta_id: 'conta-1', subcategoria_id: null, descricao: 'Compra', valor: 100,
      tipo: 'Despesa', data_transacao: '2025-01-31T12:00:00.000Z', status: 'Pago',
      total_parcelas: 3, recorrente: false,
    }, 'usuario-1');

    expect(mocks.transaction).toHaveBeenCalledOnce();
    const created = mocks.tx.transacao.createMany.mock.calls[0][0].data;
    expect(created.map((item: any) => item.valor)).toEqual([33.34, 33.33, 33.33]);
    expect(created.map((item: any) => item.data_transacao.toISOString())).toEqual([
      '2025-01-31T12:00:00.000Z',
      '2025-02-28T12:00:00.000Z',
      '2025-03-31T12:00:00.000Z',
    ]);
    expect(mocks.tx.faturaCartao.createMany).toHaveBeenCalledOnce();
    expect(mocks.tx.faturaCartao.findMany).toHaveBeenCalledOnce();
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.contaBancaria.update).toHaveBeenCalledWith({
      where: { id: 'conta-1' }, data: { saldo_atual: { increment: 100 } },
    });
  });

  it('cria receitas recorrentes mensais e credita somente a primeira recebida', async () => {
    mocks.accountOwnership.mockResolvedValue({ id: 'conta-1', tipo: 'Corrente' });
    const service = new TransacaoService();
    await service.criarTransacao({
      conta_id: 'conta-1', subcategoria_id: null, descricao: 'Contrato mensal', valor: 2500,
      tipo: 'Receita', data_transacao: '2026-08-31T12:00:00.000Z', status: 'Pago',
      total_parcelas: 3, recorrente: true,
    }, 'usuario-1');

    const created = mocks.tx.transacao.createMany.mock.calls[0][0].data;
    expect(created.map((item: any) => ({ valor: item.valor, status: item.status, parcela: item.parcela_atual }))).toEqual([
      { valor: 2500, status: 'Pago', parcela: 1 },
      { valor: 2500, status: 'Pendente', parcela: 2 },
      { valor: 2500, status: 'Pendente', parcela: 3 },
    ]);
    expect(created.map((item: any) => item.data_transacao.toISOString())).toEqual([
      '2026-08-31T12:00:00.000Z',
      '2026-09-30T12:00:00.000Z',
      '2026-10-31T12:00:00.000Z',
    ]);
    expect(mocks.tx.contaBancaria.update).toHaveBeenCalledWith({
      where: { id: 'conta-1' }, data: { saldo_atual: { increment: 2500 } },
    });
  });

  it('cria os dois lados da transferência e atualiza ambas as contas atomicamente', async () => {
    mocks.accountOwnership
      .mockResolvedValueOnce({ id: 'conta-1', tipo: 'Corrente' })
      .mockResolvedValueOnce({ id: 'conta-2', tipo: 'Poupanca' });
    mocks.tx.transacao.create
      .mockResolvedValueOnce({ id: 'saida-1', descricao: '[Saída] Reserva' })
      .mockResolvedValueOnce({ id: 'entrada-1', descricao: '[Entrada] Reserva' });

    const service = new TransacaoService();
    await service.criarTransacao({
      conta_id: 'conta-1', conta_destino_id: 'conta-2', descricao: 'Reserva', valor: 40,
      tipo: 'Transferencia', data_transacao: '2026-08-07T12:00:00.000Z', status: 'Pago',
      total_parcelas: 1, recorrente: false,
    }, 'usuario-1');

    expect(mocks.tx.transferenciaGrupo.create).toHaveBeenCalledOnce();
    expect(mocks.tx.transacao.create).toHaveBeenCalledTimes(2);
    expect(mocks.tx.contaBancaria.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'conta-1' }, data: { saldo_atual: { increment: -40 } },
    });
    expect(mocks.tx.contaBancaria.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'conta-2' }, data: { saldo_atual: { increment: 40 } },
    });
  });

  it('cria os dois lados de cada transferência recorrente e movimenta apenas a primeira ocorrência', async () => {
    mocks.accountOwnership
      .mockResolvedValueOnce({ id: 'conta-1', tipo: 'Corrente' })
      .mockResolvedValueOnce({ id: 'conta-2', tipo: 'Poupanca' });
    mocks.tx.transferenciaGrupo.create
      .mockResolvedValueOnce({ id: 'grupo-1' })
      .mockResolvedValueOnce({ id: 'grupo-2' })
      .mockResolvedValueOnce({ id: 'grupo-3' });
    mocks.tx.transacao.create.mockImplementation(async ({ data }: any) => ({ id: `transacao-${mocks.tx.transacao.create.mock.calls.length}`, ...data }));

    const service = new TransacaoService();
    const result = await service.criarTransacao({
      conta_id: 'conta-1', conta_destino_id: 'conta-2', descricao: 'Aporte mensal', valor: 300,
      tipo: 'Transferencia', data_transacao: '2026-08-31T12:00:00.000Z', status: 'Pago',
      total_parcelas: 3, recorrente: true,
    }, 'usuario-1');

    expect(mocks.tx.transferenciaGrupo.create).toHaveBeenCalledTimes(3);
    expect(mocks.tx.transacao.create).toHaveBeenCalledTimes(6);
    const created = mocks.tx.transacao.create.mock.calls.map(([call]) => call.data);
    expect(created.map((item: any) => ({ parcela: item.parcela_atual, status: item.status, direcao: item.transferencia_direcao }))).toEqual([
      { parcela: 1, status: 'Pago', direcao: 'Saida' },
      { parcela: 1, status: 'Pago', direcao: 'Entrada' },
      { parcela: 2, status: 'Pendente', direcao: 'Saida' },
      { parcela: 2, status: 'Pendente', direcao: 'Entrada' },
      { parcela: 3, status: 'Pendente', direcao: 'Saida' },
      { parcela: 3, status: 'Pendente', direcao: 'Entrada' },
    ]);
    expect(new Set(created.map((item: any) => item.transacao_pai_id)).size).toBe(1);
    expect(mocks.tx.contaBancaria.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'conta-1' }, data: { saldo_atual: { increment: -300 } },
    });
    expect(mocks.tx.contaBancaria.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'conta-2' }, data: { saldo_atual: { increment: 300 } },
    });
    expect(result).toEqual(expect.objectContaining({ message: '3 transferências recorrentes criadas com sucesso.' }));
  });
});
