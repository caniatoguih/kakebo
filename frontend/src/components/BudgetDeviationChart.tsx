import type { PainelReflexaoData } from '@/services/relatoriosService';

type Deviation = PainelReflexaoData['desvios'][number];
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function BudgetDeviationChart({ data }: { data: Deviation[] }) {
  const relevant = data.filter((item) => item.diferenca !== 0).slice(0, 5);
  const maximum = Math.max(1, ...relevant.map((item) => Math.abs(item.diferenca)));

  if (relevant.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum desvio relevante neste mês.</p>;

  return <figure className="space-y-4" aria-label="Categorias com os maiores desvios em relação ao orçamento">
    {relevant.map((item) => {
      const overBudget = item.diferenca > 0;
      return <div key={`${item.pilar}-${item.categoria}`} className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate font-medium">{item.categoria}</span>
          <span className={`shrink-0 font-semibold ${overBudget ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {overBudget ? '+' : '−'} {brl(Math.abs(item.diferenca))}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={`h-full rounded-full ${overBudget ? 'bg-rose-500' : 'bg-emerald-600'}`} style={{ width: `${(Math.abs(item.diferenca) / maximum) * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{brl(item.realizado)} realizado de {brl(item.orcado)} planejado</p>
      </div>;
    })}
  </figure>;
}
