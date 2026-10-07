import { describe, expect, it } from 'vitest';
import { determineInvoiceStatus } from '../src/services/InvoiceService';

const now = new Date('2026-08-07T12:00:00.000Z');

describe('invoice status', () => {
  it('distinguishes partial and total payments', () => {
    const base = {
      total: 100,
      closingDate: new Date('2026-08-01T00:00:00.000Z'),
      dueDate: new Date('2026-08-15T23:59:59.999Z'),
      now,
    };
    expect(determineInvoiceStatus({ ...base, paid: 40 })).toBe('ParcialmentePaga');
    expect(determineInvoiceStatus({ ...base, paid: 100 })).toBe('Paga');
  });

  it('returns to partial after a payment reversal', () => {
    expect(determineInvoiceStatus({
      total: 100,
      paid: 70,
      closingDate: new Date('2026-08-01T00:00:00.000Z'),
      dueDate: new Date('2026-08-15T23:59:59.999Z'),
      now,
    })).toBe('ParcialmentePaga');
  });

  it('handles credits that reduce the invoice to zero', () => {
    expect(determineInvoiceStatus({
      total: 0,
      paid: 0,
      closingDate: new Date('2026-08-01T00:00:00.000Z'),
      dueDate: new Date('2026-08-15T23:59:59.999Z'),
      now,
    })).toBe('Fechada');
  });

  it('marks an unpaid invoice overdue after its due date', () => {
    expect(determineInvoiceStatus({
      total: 100,
      paid: 0,
      closingDate: new Date('2026-07-20T00:00:00.000Z'),
      dueDate: new Date('2026-08-05T23:59:59.999Z'),
      now,
    })).toBe('Vencida');
  });

  it('does not mark a settled invoice overdue because of floating point sums', () => {
    expect(determineInvoiceStatus({
      total: 401.08000000000004,
      paid: 401.08,
      closingDate: new Date('2026-08-26T00:00:00Z'),
      dueDate: new Date('2026-09-07T23:59:59.999Z'),
      now: new Date('2026-10-07T12:00:00Z'),
    })).toBe('Paga');
  });

  it('still marks one outstanding cent overdue', () => {
    expect(determineInvoiceStatus({
      total: 401.08,
      paid: 401.07,
      closingDate: new Date('2026-08-26T00:00:00Z'),
      dueDate: new Date('2026-09-07T23:59:59.999Z'),
      now: new Date('2026-10-07T12:00:00Z'),
    })).toBe('Vencida');
  });
});
