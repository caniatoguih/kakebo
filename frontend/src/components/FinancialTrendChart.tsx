import type { PainelReflexaoData } from '@/services/relatoriosService';
import { KakeboChart } from '@/components/charts/KakeboChart';

type TrendItem = PainelReflexaoData['historico'][number];
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
const label = (value: string) => new Intl.DateTimeFormat('pt-BR', { month: 'short' })
  .format(new Date(`${value}-01T12:00:00`)).replace('.', '');

export function FinancialTrendChart({ data }: { data: TrendItem[] }) {
  const maximum = Math.max(1, ...data.flatMap((item) => [item.receitas, item.despesas]));
  return <figure className="space-y-4" aria-label="Evolução de receitas e despesas realizadas nos últimos seis meses">
    <div className="flex gap-4 text-xs font-medium text-muted-foreground" aria-hidden="true">
      <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-chart-income" />Receitas</span>
      <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-chart-expense" />Despesas</span>
    </div>
    <KakeboChart className="grid h-56 grid-cols-6 items-end gap-2" aria-hidden="true">
      {data.map((item) => <div key={item.competencia} className="flex h-full min-w-0 flex-col justify-end gap-2">
        <div className="flex flex-1 items-end justify-center gap-1">
          <div className="w-2.5 rounded-t bg-chart-income transition-all duration-200 sm:w-4" style={{ height: `${Math.max(2, item.receitas / maximum * 100)}%` }} title={`Receitas: ${brl(item.receitas)}`} />
          <div className="w-2.5 rounded-t bg-chart-expense transition-all duration-200 sm:w-4" style={{ height: `${Math.max(2, item.despesas / maximum * 100)}%` }} title={`Despesas: ${brl(item.despesas)}`} />
        </div>
        <span className="truncate text-center text-[10px] text-muted-foreground sm:text-xs">{label(item.competencia)}</span>
      </div>)}
    </KakeboChart>
    <div className="sr-only">{data.map((item) => <p key={item.competencia}>{label(item.competencia)}: receitas {brl(item.receitas)}, despesas {brl(item.despesas)}, resultado {brl(item.resultado)}.</p>)}</div>
  </figure>;
}
