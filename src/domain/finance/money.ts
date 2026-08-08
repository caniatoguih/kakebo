export type MoneyInput = number | string | { toString(): string };

export function toCents(value: MoneyInput): number {
  const normalized = typeof value === 'number' ? value : Number(value.toString());
  if (!Number.isFinite(normalized)) throw new Error('Valor monetário inválido.');
  return Math.round((normalized + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) throw new Error('Valor em centavos inválido.');
  return cents / 100;
}

export function distributeCents(totalCents: number, installments: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error('Total em centavos inválido.');
  if (!Number.isInteger(installments) || installments < 1) throw new Error('Quantidade de parcelas inválida.');

  const base = Math.floor(totalCents / installments);
  const remainder = totalCents % installments;
  return Array.from({ length: installments }, (_, index) => base + (index < remainder ? 1 : 0));
}
