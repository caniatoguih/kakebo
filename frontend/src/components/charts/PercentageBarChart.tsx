export type PercentageBarItem = { id: string; label: string; value: number };

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(value);
const percentage = (value: number) => new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
}).format(value);

export function PercentageBarChart({ items, total, color }: { items: PercentageBarItem[]; total: number; color: string }) {
  return <figure aria-label="Participação percentual e valor absoluto das subcategorias" className="space-y-4">
    {items.map((item) => {
      const itemPercentage = total > 0 ? item.value / total * 100 : 0;
      return <div key={item.id} className="space-y-1.5">
        <div className="flex items-start justify-between gap-3 text-sm">
          <figcaption className="min-w-0 truncate font-medium" title={item.label}>{item.label}</figcaption>
          <span className="shrink-0 text-right tabular-nums"><strong>{percentage(itemPercentage)}%</strong><span className="ml-2 text-xs text-muted-foreground">{money(item.value)}</span></span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full min-w-px rounded-full transition-all duration-300" style={{ width: `${itemPercentage}%`, backgroundColor: color }} />
        </div>
        <span className="sr-only">{item.label}: {percentage(itemPercentage)}% da categoria, equivalente a {money(item.value)}.</span>
      </div>;
    })}
  </figure>;
}
