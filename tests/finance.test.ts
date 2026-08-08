import { describe, expect, it } from 'vitest';
import { distributeCents, fromCents, toCents } from '../src/domain/finance/money';
import { addMonthsClamped } from '../src/domain/finance/monthlyDate';
import { calculateAccountBalanceCents, calculateBalanceImpactCents } from '../src/domain/finance/balanceImpact';

describe('dinheiro', () => {
  it('converte valores para centavos sem ruído binário', () => {
    expect(toCents(10.1 + 20.2)).toBe(3030);
    expect(fromCents(3030)).toBe(30.3);
  });

  it('distribui centavos preservando exatamente o total', () => {
    const installments = distributeCents(10_000, 3);
    expect(installments).toEqual([3334, 3333, 3333]);
    expect(installments.reduce((sum, value) => sum + value, 0)).toBe(10_000);
  });
});

describe('recorrência mensal', () => {
  it('mantém o último dia válido sem pular fevereiro', () => {
    const january31 = new Date('2025-01-31T12:00:00.000Z');
    expect(addMonthsClamped(january31, 1).toISOString()).toBe('2025-02-28T12:00:00.000Z');
    expect(addMonthsClamped(january31, 2).toISOString()).toBe('2025-03-31T12:00:00.000Z');
  });

  it('respeita fevereiro em ano bissexto', () => {
    expect(addMonthsClamped(new Date('2024-01-30T00:00:00.000Z'), 1).getUTCDate()).toBe(29);
  });
});

describe('impacto no saldo', () => {
  it('ignora lançamentos pendentes em contas comuns', () => {
    expect(calculateBalanceImpactCents({ accountType: 'Corrente', transactionType: 'Despesa', status: 'Pendente', value: 50 })).toBe(0);
  });

  it('trata compra pendente no cartão como dívida comprometida', () => {
    expect(calculateBalanceImpactCents({ accountType: 'CartaoCredito', transactionType: 'Despesa', status: 'Pendente', value: 50 })).toBe(5000);
  });

  it('não compromete o limite com recorrências futuras ainda pendentes', () => {
    expect(calculateBalanceImpactCents({
      accountType: 'CartaoCredito', transactionType: 'Despesa', status: 'Pendente',
      value: 50, recurring: true, installmentNumber: 2,
    })).toBe(0);
  });

  it('aplica corretamente as duas pontas de transferência', () => {
    expect(calculateBalanceImpactCents({ accountType: 'Corrente', transactionType: 'Transferencia', status: 'Pago', description: '[Saída] PIX', value: 25 })).toBe(-2500);
    expect(calculateBalanceImpactCents({ accountType: 'Corrente', transactionType: 'Transferencia', status: 'Pago', description: '[Entrada] PIX', value: 25 })).toBe(2500);
  });

  it('recalcula uma conta com a mesma regra usada nas escritas', () => {
    expect(calculateAccountBalanceCents('Corrente', 100, [
      { tipo: 'Receita', status: 'Pago', descricao: 'Salário', valor: 50 },
      { tipo: 'Despesa', status: 'Pago', descricao: 'Mercado', valor: 20.01 },
      { tipo: 'Despesa', status: 'Pendente', descricao: 'Prevista', valor: 99 },
    ])).toBe(12_999);
  });
});
