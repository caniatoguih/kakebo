import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ accounts: vi.fn(), invoices: vi.fn(), transactions: vi.fn() }));
vi.mock('../src/lib/prisma', () => ({ default: {
  contaBancaria: { findMany: mocks.accounts },
  faturaCartao: { findMany: mocks.invoices },
  transacao: { findMany: mocks.transactions },
} }));
import { ContaController } from '../src/controllers/ContaController';

const purchase = { tipo: 'Despesa', descricao: 'Compra parcelada (2/3)', valor: 120, data_transacao: new Date('2026-09-15T12:00:00Z') };
const october = {
  id: 'october', competencia: '2026-10', data_fechamento: new Date('2026-10-05T00:00:00Z'),
  data_vencimento: new Date('2026-10-12T00:00:00Z'), total: 0, total_pago: 0, transacoes: [],
};

async function listCard() {
  const json = vi.fn();
  const response = { json, status: vi.fn().mockReturnThis() };
  await new ContaController().list({ usuario_id: 'user' } as Request, response as unknown as Response);
  expect(response.status).not.toHaveBeenCalled();
  return json.mock.calls[0][0][0];
}

describe('saldo da fatura selecionada para pagamento', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    vi.clearAllMocks();
    mocks.accounts.mockResolvedValue([{ id: 'card', tipo: 'CartaoCredito', cartao_detalhe: { dia_fechamento: 5, dia_vencimento: 12 } }]);
    mocks.transactions.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it('inclui parcela legada mesmo quando o total salvo está zerado', async () => {
    mocks.invoices.mockResolvedValue([october]);
    mocks.transactions.mockResolvedValue([purchase]);
    expect(await listCard()).toMatchObject({ fatura_fechada: 120, fatura_fechada_id: 'october', fatura_fechada_competencia: '2026-10' });
  });

  it('inclui parcela vinculada mesmo quando o total salvo está desatualizado', async () => {
    mocks.invoices.mockResolvedValue([{ ...october, transacoes: [purchase] }]);
    expect(await listCard()).toMatchObject({ fatura_fechada: 120, fatura_fechada_id: 'october' });
  });

  it('ignora fatura liquidada por pagamento legado e seleciona dívida anterior', async () => {
    const september = { ...october, id: 'september', competencia: '2026-09', data_fechamento: new Date('2026-09-05T00:00:00Z'), transacoes: [{ ...purchase, valor: 50 }] };
    mocks.invoices.mockResolvedValue([{ ...october, total: 120, transacoes: [purchase] }, september]);
    mocks.transactions.mockResolvedValue([{ tipo: 'Transferencia', descricao: 'Pagamento fatura [Entrada]', valor: 120, data_transacao: new Date('2026-10-06T12:00:00Z') }]);
    expect(await listCard()).toMatchObject({ fatura_fechada: 50, fatura_fechada_id: 'september' });
  });

  it('mantém parcela de fatura aberta fora do saldo disponível para pagamento', async () => {
    mocks.invoices.mockResolvedValue([{ ...october, data_fechamento: new Date('2026-10-10T00:00:00Z'), transacoes: [purchase] }]);
    expect(await listCard()).toMatchObject({ fatura_atual: 120, fatura_fechada: 0, fatura_fechada_id: undefined });
  });

  it('identifica setembro com vencimento em outubro mesmo sem registro da fatura legada', async () => {
    mocks.accounts.mockResolvedValue([{ id: 'card', tipo: 'CartaoCredito', cartao_detalhe: { dia_fechamento: 26, dia_vencimento: 7 } }]);
    mocks.invoices.mockResolvedValue([{ ...october, data_fechamento: new Date('2026-10-26T00:00:00Z') }]);
    mocks.transactions.mockResolvedValue([{ ...purchase, valor: 72.51, data_transacao: new Date('2026-09-06T12:00:00Z') }]);
    expect(await listCard()).toMatchObject({ fatura_fechada: 72.51, fatura_fechada_id: undefined, fatura_fechada_competencia: '2026-09', fatura_fechada_vencimento: new Date('2026-10-07T23:59:59.999Z') });
  });
});
