import { describe, expect, it } from 'vitest';
import { findNextOpenInvoice } from '../src/controllers/ContaController';

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
