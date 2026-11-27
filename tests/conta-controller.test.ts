import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    contaBancaria: { findFirst: vi.fn(), update: vi.fn() },
    transacao: { findMany: vi.fn() },
  };
  return { tx, transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
});
vi.mock('../src/lib/prisma', () => ({ default: { $transaction: mocks.transaction } }));
vi.mock('../src/services/InvoiceService', () => ({ determineInvoiceStatus: vi.fn() }));

import { ContaController, findNextOpenInvoice } from '../src/controllers/ContaController';

function response() {
  return { json: vi.fn(), status: vi.fn().mockReturnThis() };
}

describe('recálculo do saldo de conta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.contaBancaria.findFirst.mockResolvedValue({ id: 'conta-1', tipo: 'Corrente', saldo_inicial: 100 });
    mocks.tx.transacao.findMany.mockResolvedValue([
      { tipo: 'Receita', status: 'Pago', descricao: 'Salário', valor: 50 },
      { tipo: 'Despesa', status: 'Pago', descricao: 'Mercado', valor: 20.01 },
      { tipo: 'Despesa', status: 'Pendente', descricao: 'Prevista', valor: 99 },
    ]);
    mocks.tx.contaBancaria.update.mockImplementation(async ({ data }: any) => ({ id: 'conta-1', tipo: 'Corrente', ...data }));
  });

  it('edita o saldo inicial e recalcula os lançamentos em uma única transação', async () => {
    const res = response();
    await new ContaController().update({ usuario_id: 'usuario-1', params: { id: 'conta-1' }, body: { saldo_inicial: 200 } } as unknown as Request, res as unknown as Response);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ saldo_atual: 229.99 }));
    expect(mocks.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('refaz a leitura após conflito com um lançamento simultâneo', async () => {
    mocks.transaction.mockRejectedValueOnce(Object.assign(new Error('Conflito de escrita'), { code: 'P2034' }));
    const res = response();
    await new ContaController().recalculate({ usuario_id: 'usuario-1', params: { id: 'conta-1' } } as unknown as Request, res as unknown as Response);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ saldo_atual: 129.99 }));
  });

  it('não persiste saldo inicial em cartão de crédito', async () => {
    mocks.tx.contaBancaria.findFirst.mockResolvedValue({ id: 'conta-1', tipo: 'CartaoCredito', saldo_inicial: 0 });
    mocks.tx.contaBancaria.update.mockImplementation(async ({ data }: any) => ({ id: 'conta-1', tipo: 'CartaoCredito', ...data }));
    mocks.tx.transacao.findMany.mockResolvedValue([{ tipo: 'Despesa', status: 'Pendente', descricao: 'Compra', valor: 20.01 }]);
    const res = response();
    await new ContaController().update({ usuario_id: 'usuario-1', params: { id: 'conta-1' }, body: { saldo_inicial: 200 } } as unknown as Request, res as unknown as Response);
    expect(mocks.tx.contaBancaria.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ saldo_inicial: 0 }) }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ saldo_atual: 20.01 }));
  });

  it('retorna 404 sem escrever quando a conta pertence a outro usuário', async () => {
    mocks.tx.contaBancaria.findFirst.mockResolvedValue(null);
    const res = response();
    await new ContaController().recalculate({ usuario_id: 'usuario-1', params: { id: 'conta-1' } } as unknown as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.tx.contaBancaria.update).not.toHaveBeenCalled();
  });

  it('encerra as tentativas após três conflitos', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      mocks.transaction.mockRejectedValueOnce(Object.assign(new Error('Conflito de escrita'), { code: 'P2034' }));
    }
    const res = response();
    await new ContaController().recalculate({ usuario_id: 'usuario-1', params: { id: 'conta-1' } } as unknown as Request, res as unknown as Response);
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.tx.contaBancaria.update).not.toHaveBeenCalled();
  });
});

describe('selecao da fatura aberta do cartao', () => {
  it('escolhe a proxima fatura a fechar, mesmo quando a consulta vem decrescente', () => {
    const invoices = [
      { id: 'futura-distante', data_fechamento: new Date('2026-10-30T00:00:00.000Z') },
      { id: 'proxima', data_fechamento: new Date('2026-08-30T00:00:00.000Z') },
      { id: 'fechada', data_fechamento: new Date('2026-07-30T00:00:00.000Z') },
    ];

    expect(findNextOpenInvoice(invoices, new Date('2026-08-10T12:00:00.000Z'))?.id).toBe('proxima');
  });
});
