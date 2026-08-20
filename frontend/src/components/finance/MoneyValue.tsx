import { cn } from '@/lib/utils';

const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(value: number) {
  return formatter.format(value);
}

export function MoneyValue({ value, className, showSign = false }: { value: number; className?: string; showSign?: boolean }) {
  const sign = showSign && value > 0 ? '+' : '';
  return <span className={cn('font-display tabular-nums tracking-tight', className)}>{sign}{formatMoney(value)}</span>;
}
