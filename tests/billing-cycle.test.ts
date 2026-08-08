import { describe, expect, it } from 'vitest';
import {
  getBillingCycleForDate, getCashFlowMonthForCardTransaction,
  getLastClosedBillingCycle, getOpenBillingCycle,
} from '../src/domain/billing/billingCycle';

describe('ciclo de faturamento', () => {
  it('atribui compras no fechamento ao ciclo seguinte', () => {
    expect(getBillingCycleForDate(new Date('2026-08-09T23:59:59.999Z'), 10, 17).competence).toBe('2026-08');
    expect(getBillingCycleForDate(new Date('2026-08-10T00:00:00.000Z'), 10, 17).competence).toBe('2026-09');
  });

  it('calcula vencimento no mês seguinte quando o dia é anterior ao fechamento', () => {
    const cycle = getBillingCycleForDate(new Date('2026-08-20T00:00:00.000Z'), 25, 5);
    expect(cycle.competence).toBe('2026-08');
    expect(cycle.dueDate.toISOString()).toBe('2026-09-05T23:59:59.999Z');
    expect(getCashFlowMonthForCardTransaction(new Date('2026-08-20T00:00:00.000Z'), 25, 5)).toBe('2026-09');
  });

  it('distingue o ciclo aberto do último fechado', () => {
    const now = new Date('2026-08-15T12:00:00.000Z');
    expect(getOpenBillingCycle(now, 10, 17).competence).toBe('2026-09');
    expect(getLastClosedBillingCycle(now, 10, 17).competence).toBe('2026-08');
  });

  it('trata fechamento no dia 31 em meses curtos', () => {
    const cycle = getBillingCycleForDate(new Date('2026-02-27T23:00:00.000Z'), 31, 5);
    expect(cycle.competence).toBe('2026-02');
    expect(cycle.closingDate.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });
});
