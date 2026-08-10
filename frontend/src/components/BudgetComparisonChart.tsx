export type BudgetChartItem = { name: string; Orcado: number; Realizado: number; fillOrcado: string; fillRealizado: string };

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function BudgetComparisonChart({ data }: { data: BudgetChartItem[] }) {
  const maximum = Math.max(1, ...data.flatMap((item) => [item.Orcado, item.Realizado]));

  return <figure className="mt-4 space-y-5" aria-label="Comparação entre valores orçados e realizados por pilar">
    <div className="flex justify-end gap-4 text-xs font-medium text-muted-foreground" aria-hidden="true">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Orçado</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Realizado</span>
    </div>
    {data.map((item) => <div key={item.name} className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-center">
      <figcaption className="text-sm font-semibold">{item.name}</figcaption>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2"><div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full min-w-px rounded-full" style={{ width: `${(item.Orcado / maximum) * 100}%`, backgroundColor: item.fillOrcado }} /></div><span className="w-24 text-right text-xs text-muted-foreground">{brl(item.Orcado)}</span></div>
        <div className="flex items-center gap-2"><div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full min-w-px rounded-full" style={{ width: `${(item.Realizado / maximum) * 100}%`, backgroundColor: item.fillRealizado }} /></div><span className="w-24 text-right text-xs font-semibold">{brl(item.Realizado)}</span></div>
      </div>
      <span className="sr-only">{item.name}: orçado {brl(item.Orcado)}; realizado {brl(item.Realizado)}.</span>
    </div>)}
  </figure>;
}
