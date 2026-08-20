import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export type DonutChartItem = {
  id: string;
  label: string;
  detail?: string;
  value: number;
  color: string;
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
}).format(value);
const percentage = (value: number) => new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
}).format(value);

export function CategoryDonutChart({
  items,
  total,
  selectedId,
  onSelect,
}: {
  items: DonutChartItem[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const segmentLengths = items.map((item) => total > 0 ? item.value / total * circumference : 0);
  const chartSegments = items.map((item, index) => ({
    ...item,
    segmentLength: segmentLengths[index],
    dashOffset: -segmentLengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }));

  const selectWithKeyboard = (event: KeyboardEvent<SVGCircleElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  };

  return <figure className="grid gap-5 sm:grid-cols-[15rem_minmax(0,1fr)] sm:items-center" aria-label="Distribuição percentual das despesas por categoria">
    <div className="relative mx-auto h-60 w-60 shrink-0">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-label="Categorias de gastos; selecione uma fatia para ver as subcategorias">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="20" />
        {chartSegments.map((item) => {
          const visibleLength = Math.max(0, item.segmentLength - 3);
          const selected = item.id === selectedId;
          return <circle
            key={item.id}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={item.color}
            strokeWidth={selected ? 25 : 20}
            strokeDasharray={`${visibleLength} ${circumference - visibleLength}`}
            strokeDashoffset={item.dashOffset}
            className={cn('cursor-pointer transition-all duration-200 focus:outline-none', selected ? 'opacity-100' : 'opacity-75 hover:opacity-100')}
            role="button"
            tabIndex={0}
            aria-label={`${item.label}: ${percentage(total > 0 ? item.value / total * 100 : 0)}%, ${money(item.value)}`}
            aria-pressed={selected}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => selectWithKeyboard(event, item.id)}
          />;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
        <span className="text-xs text-muted-foreground">Total gasto</span>
        <strong className="mt-1 font-display text-xl tabular-nums text-foreground">{money(total)}</strong>
      </div>
    </div>

    <div className="max-h-80 space-y-1 overflow-y-auto pr-1" aria-label="Selecione uma categoria">
      {items.map((item) => {
        const selected = item.id === selectedId;
        const itemPercentage = total > 0 ? item.value / total * 100 : 0;
        return <button
          key={item.id}
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(item.id)}
          className={cn(
            'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
          )}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.label}</span>{item.detail && <span className="block truncate text-[11px] text-muted-foreground">{item.detail}</span>}</span>
          <span className="text-right"><strong className="block text-sm tabular-nums">{percentage(itemPercentage)}%</strong><span className="block text-[11px] tabular-nums text-muted-foreground">{money(item.value)}</span></span>
        </button>;
      })}
    </div>
  </figure>;
}
