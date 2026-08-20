import type { PainelReflexaoData } from '@/services/relatoriosService';
import { formatMoney } from '@/components/finance/MoneyValue';
import { cn } from '@/lib/utils';

type Deviation = PainelReflexaoData['desvios'][number];

export function BudgetDeviationList({ data }: { data: Deviation[] }) {
  const relevant = data.filter((item) => item.diferenca !== 0).slice(0, 5);
  const maximum = Math.max(1, ...relevant.map((item) => Math.abs(item.diferenca)));

  if (relevant.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum desvio relevante neste mês.</p>;

  return <figure className="space-y-5" aria-label="Categorias com os maiores desvios em relação ao orçamento">
    {relevant.map((item) => {
      const overBudget = item.diferenca > 0;
      return <div key={`${item.pilar}-${item.categoria}`} className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate font-semibold">{item.categoria}</span>
          <span className={cn('shrink-0 font-display font-bold tabular-nums', overBudget ? 'text-destructive' : 'text-success')}>
            {overBudget ? '+' : '−'} {formatMoney(Math.abs(item.diferenca))}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all duration-200', overBudget ? 'bg-chart-expense' : 'bg-chart-income')} style={{ width: `${(Math.abs(item.diferenca) / maximum) * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{formatMoney(item.realizado)} realizado de {formatMoney(item.orcado)} planejado</p>
      </div>;
    })}
  </figure>;
}
