import React, { Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BookOpen, Landmark, Sparkles, Target, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandPattern } from '@/components/brand/BrandPattern';
import { FinancialTrendChart } from '@/components/FinancialTrendChart';
import { BudgetDeviationList } from '@/components/finance/BudgetDeviationList';
import { InsightCard, type InsightTone } from '@/components/finance/InsightCard';
import { KpiCard, KpiCardSkeleton } from '@/components/finance/KpiCard';
import { formatMoney } from '@/components/finance/MoneyValue';
import { MonthlyReflection } from '@/components/finance/MonthlyReflection';
import { SpendingBreakdown, type SpendingCategory } from '@/components/finance/SpendingBreakdown';
import { MonthNavigator } from '@/components/layout/MonthNavigator';
import { PageHeader } from '@/components/layout/PageHeader';
import { SetupChecklist } from '@/components/SetupChecklist';
import { EmptyState } from '@/components/EmptyState';
import { QueryErrorState } from '@/components/QueryErrorState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { contasService } from '@/services/contasService';
import { orcamentosService } from '@/services/orcamentosService';
import { relatoriosService, type PainelReflexaoData } from '@/services/relatoriosService';
import { transacoesService } from '@/services/transacoesService';

const BudgetComparisonChart = React.lazy(() => import('@/components/BudgetComparisonChart').then((module) => ({ default: module.BudgetComparisonChart })));

const PILAR_CONFIG = {
  Sobrevivencia: {
    label: 'Sobrevivência',
    description: 'Moradia, alimentação, saúde e necessidades essenciais.',
    icon: Wallet,
    card: 'border-primary/15 bg-primary/5',
    badge: 'bg-primary/10 text-primary',
    progress: 'bg-chart-income',
    tone: 'income',
  },
  Lazer: {
    label: 'Lazer',
    description: 'Diversão, passeios e experiências que trazem bem-estar.',
    icon: Sparkles,
    card: 'border-chart-leisure/30 bg-chart-leisure/10',
    badge: 'bg-chart-leisure/25 text-foreground',
    progress: 'bg-chart-leisure',
    tone: 'leisure',
  },
  Cultura: {
    label: 'Cultura',
    description: 'Educação, livros e atividades para seu desenvolvimento.',
    icon: BookOpen,
    card: 'border-chart-culture/35 bg-chart-culture/10',
    badge: 'bg-chart-culture/25 text-foreground',
    progress: 'bg-chart-culture',
    tone: 'culture',
  },
  Extras: {
    label: 'Extras / Imprevistos',
    description: 'Gastos inesperados e despesas fora da rotina.',
    icon: TrendingUp,
    card: 'border-chart-extra/25 bg-chart-extra/5',
    badge: 'bg-chart-extra/10 text-chart-extra',
    progress: 'bg-chart-extra',
    tone: 'extra',
  },
} as const;

type Pilar = keyof typeof PILAR_CONFIG;
const PILAR_ORDER: Pilar[] = ['Sobrevivencia', 'Lazer', 'Cultura', 'Extras'];

const decimal = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
const percent = (value: number | null) => value === null ? '—' : `${decimal(value)}%`;

type KpiTrend = {
  value: string;
  direction: 'up' | 'down' | 'neutral';
  tone: 'positive' | 'negative' | 'neutral';
};

function comparisonTrend(value: number | null, inverse = false): KpiTrend | undefined {
  if (value === null) return undefined;
  const favorable = inverse ? value <= 0 : value >= 0;
  return {
    value: `${Math.abs(value).toFixed(0)}% vs. mês anterior`,
    direction: value > 0 ? 'up' : value < 0 ? 'down' : 'neutral',
    tone: favorable ? 'positive' : 'negative',
  };
}

function insightTone(type: PainelReflexaoData['insights'][number]['tipo']): InsightTone {
  if (type === 'positivo') return 'success';
  if (type === 'atencao') return 'warning';
  return 'info';
}

function ReflectionLoading() {
  return <div className="space-y-6" aria-label="Carregando reflexões">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <KpiCardSkeleton key={index} />)}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]"><Skeleton className="h-80 rounded-lg" /><Skeleton className="h-80 rounded-lg" /></div>
  </div>;
}

export function Dashboard(): React.ReactElement {
  const { usuario } = useAuth();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const mes = currentDate.getMonth() + 1;
  const ano = currentDate.getFullYear();

  const { data, isLoading, isError, isFetching, error: queryError, refetch } = useQuery<PainelReflexaoData>({
    queryKey: ['relatorio-reflexao', mes, ano],
    queryFn: () => relatoriosService.getPainelReflexao(mes, ano),
  });
  const accountsSetupQuery = useQuery({ queryKey: ['contas'], queryFn: contasService.listar });
  const budgetsSetupQuery = useQuery({ queryKey: ['orcamentos', mes, ano], queryFn: () => orcamentosService.listar(mes, ano) });
  const transactionsSetupQuery = useQuery({ queryKey: ['transacoes', 'setup'], queryFn: () => transacoesService.listar({ page: 1, limit: 1 }) });
  const setupReady = [accountsSetupQuery, budgetsSetupQuery, transactionsSetupQuery].every((query) => !query.isLoading && !query.isError);
  const categoriesReviewed = !!usuario && localStorage.getItem(`kakebo:categories-reviewed:${usuario.id}`) === 'true';

  const previousMonth = () => setCurrentDate(new Date(ano, mes - 2, 1));
  const nextMonth = () => setCurrentDate(new Date(ano, mes, 1));
  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR });
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const planningPeriod = `${ano}-${String(mes).padStart(2, '0')}`;
  const hasMonthlyData = !!data && (data.resumo.total_orcado !== 0 || data.resumo.total_realizado !== 0);

  const chartData = useMemo(() => {
    if (!data) return [];
    return PILAR_ORDER.map((pilar) => ({
      name: PILAR_CONFIG[pilar].label,
      Orcado: data.pilares[pilar]?.orcado || 0,
      Realizado: data.pilares[pilar]?.realizado || 0,
      tone: PILAR_CONFIG[pilar].tone,
    }));
  }, [data]);

  const spendingCategories = useMemo<SpendingCategory[]>(() => {
    if (!data) return [];
    const categories: SpendingCategory[] = PILAR_ORDER.flatMap((pilar) => {
      const pilarData = data.pilares[pilar];
      return Object.entries(pilarData?.categorias ?? {}).map(([categoryName, category]) => ({
        id: `${pilar}:${categoryName}`,
        name: categoryName,
        group: PILAR_CONFIG[pilar].label,
        value: Math.max(0, category.realizado),
        subcategories: Object.entries(category.subcategorias ?? {}).map(([subcategoryName, subcategory]) => ({
          id: `${pilar}:${categoryName}:${subcategoryName}`,
          name: subcategoryName,
          value: Math.max(0, subcategory.realizado),
        })),
      }));
    });
    if (data.resumo.despesas_sem_categoria > 0) {
      categories.push({
        id: 'sem-categoria',
        name: 'Sem categoria',
        group: 'Revisar lançamentos',
        value: data.resumo.despesas_sem_categoria,
        subcategories: [{ id: 'sem-categoria:sem-subcategoria', name: 'Sem subcategoria', value: data.resumo.despesas_sem_categoria }],
      });
    }
    return categories.filter((category) => category.value > 0);
  }, [data]);

  return <div className="space-y-8">
    <div className="relative overflow-hidden rounded-lg border border-primary/10 bg-card px-5 py-6 shadow-card sm:px-7">
      <BrandPattern className="pointer-events-none absolute -right-8 -top-4 h-40 w-64 opacity-[0.07]" />
      <PageHeader
        eyebrow="Caderno consciente"
        title="Reflexão Kakebo"
        description="O coração do Kakebo: analise como você viveu este mês e planeje escolhas mais conscientes."
        actions={<div className="flex flex-col gap-2 sm:items-end">
          <MonthNavigator label={capitalizedMonth} onPrevious={previousMonth} onNext={nextMonth} loading={isFetching && !isLoading} />
          <Button asChild variant="link" className="h-auto justify-center p-0 text-xs sm:justify-end"><Link to={`/planejamento?mes=${planningPeriod}`}>Ver planejamento</Link></Button>
        </div>}
        className="relative"
      />
    </div>

    {setupReady && <SetupChecklist
      hasAccount={(accountsSetupQuery.data?.length ?? 0) > 0}
      hasCategory={categoriesReviewed}
      hasBudget={(budgetsSetupQuery.data?.length ?? 0) > 0}
      hasTransaction={(transactionsSetupQuery.data?.total ?? 0) > 0}
    />}

    {isLoading && <ReflectionLoading />}
    {isError && <QueryErrorState error={queryError} title="Erro ao carregar o painel." retrying={isFetching} onRetry={() => refetch()} className="min-h-64" />}

    {!isLoading && !isError && data && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores financeiros do mês">
        <KpiCard title="Receitas" value={formatMoney(data.resumo.receitas_realizadas)} tone="success" icon={<TrendingUp />} trend={comparisonTrend(data.comparacao_mes_anterior.receitas_percentual)} />
        <KpiCard title="Despesas" value={formatMoney(data.resumo.despesas_realizadas)} tone="danger" icon={<TrendingDown />} trend={comparisonTrend(data.comparacao_mes_anterior.despesas_percentual, true)} description={data.resumo.despesas_previstas > 0 ? `+ ${formatMoney(data.resumo.despesas_previstas)} previsto` : undefined} />
        <KpiCard title="Resultado real" value={formatMoney(data.resumo.resultado_real)} tone={data.resumo.resultado_real >= 0 ? 'success' : 'danger'} icon={data.resumo.resultado_real >= 0 ? <TrendingUp /> : <TrendingDown />} description="Receitas menos despesas pagas" />
        <KpiCard title="Taxa de poupança" value={percent(data.resumo.taxa_poupanca)} tone="info" icon={<Target />} description="Parcela da renda preservada" />
      </section>

      {data.insights.length > 0 && <section className="space-y-3" aria-labelledby="insights-title">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-warning" aria-hidden="true" /><h2 id="insights-title" className="font-display text-xl font-semibold">Insights do mês</h2></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.insights.map((insight) => <InsightCard
            key={insight.titulo}
            title={insight.titulo}
            description={insight.descricao}
            tone={insightTone(insight.tipo)}
            action={insight.destino ? <Button asChild variant="link" className="h-auto p-0"><Link to={insight.destino}>Ver detalhes →</Link></Button> : undefined}
          />)}
        </div>
      </section>}

      {spendingCategories.length > 0 && <SpendingBreakdown categories={spendingCategories} total={data.resumo.despesas_realizadas} />}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        <Card className="min-w-0"><CardHeader><CardTitle>Evolução financeira</CardTitle><CardDescription>Receitas e despesas efetivamente realizadas nos últimos seis meses.</CardDescription></CardHeader><CardContent><FinancialTrendChart data={data.historico} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Maiores desvios</CardTitle><CardDescription>Categorias que mais se afastaram do planejamento.</CardDescription></CardHeader><CardContent><BudgetDeviationList data={data.desvios} /></CardContent></Card>
      </section>

      {hasMonthlyData ? <Card className="min-w-0">
        <CardHeader><CardTitle>Orçado × Realizado por Pilar</CardTitle><CardDescription>Comparativo visual de como seu orçamento foi distribuído e consumido.</CardDescription></CardHeader>
        <CardContent><Suspense fallback={<Skeleton className="mt-4 h-[350px] rounded-lg" aria-label="Carregando gráfico" />}><BudgetComparisonChart data={chartData} /></Suspense></CardContent>
      </Card> : <EmptyState icon={Target} title="Ainda não há dados para comparar neste mês" description="Crie um orçamento e registre movimentações para visualizar o comparativo entre o planejado e o realizado." action={<><Button asChild variant="outline"><Link to="/planejamento">Planejar o mês</Link></Button><Button asChild><Link to="/transacoes">Registrar movimentação</Link></Button></>} />}

      <section className="grid gap-6 lg:grid-cols-2" aria-label="Projeção e saúde financeira">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Projeção de fechamento</CardTitle><CardDescription>Estimativa baseada no ritmo atual e nos compromissos pendentes.</CardDescription></div><Target className="h-5 w-5 shrink-0 text-info" aria-hidden="true" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Despesas projetadas</p><p className="mt-1 font-display font-bold tabular-nums">{formatMoney(data.projecao.despesas_projetadas)}</p></div>
              <div className="rounded-md bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Resultado projetado</p><p className={cn('mt-1 font-display font-bold tabular-nums', data.projecao.resultado_projetado >= 0 ? 'text-success' : 'text-destructive')}>{formatMoney(data.projecao.resultado_projetado)}</p></div>
            </div>
            {data.projecao.percentual_orcamento_projetado !== null && <div>
              <div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Consumo projetado do orçamento</span><strong>{percent(data.projecao.percentual_orcamento_projetado)}</strong></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-all duration-200', data.projecao.percentual_orcamento_projetado > 100 ? 'bg-chart-expense' : 'bg-chart-extra')} style={{ width: `${Math.min(100, data.projecao.percentual_orcamento_projetado)}%` }} /></div>
            </div>}
            <p className="text-xs leading-relaxed text-muted-foreground">{formatMoney(data.projecao.compromissos_pendentes)} em despesas previstas. Projeções são estimativas, não garantias.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Saúde financeira</CardTitle><CardDescription>Sinais de comprometimento, crédito e proteção financeira.</CardDescription></div><Landmark className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <HealthMetric label="Essenciais / renda" value={percent(data.saude.percentual_renda_essenciais)} detail={formatMoney(data.saude.despesas_essenciais)} />
            <HealthMetric label="Recorrências / renda" value={percent(data.saude.percentual_renda_recorrencias)} detail={formatMoney(data.saude.compromissos_recorrentes)} />
            <HealthMetric label="Uso dos cartões" value={percent(data.saude.utilizacao_cartoes)} detail={`${formatMoney(data.saude.faturas_abertas)} em aberto`} />
            <HealthMetric label="Cobertura da reserva" value={data.saude.meses_cobertura === null ? '—' : `${decimal(data.saude.meses_cobertura)} meses`} detail={`${formatMoney(data.saude.reserva)} em poupança`} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="pillars-title">
        <div><h2 id="pillars-title" className="font-display text-xl font-semibold">Detalhamento dos pilares</h2><p className="mt-1 text-sm text-muted-foreground">Como os quatro pilares do Kakebo consumiram o planejamento deste mês.</p></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PILAR_ORDER.map((pilar) => {
            const config = PILAR_CONFIG[pilar];
            const pilarData = data.pilares[pilar];
            const budgeted = pilarData?.orcado || 0;
            const realized = pilarData?.realizado || 0;
            const usage = budgeted > 0 ? (realized / budgeted) * 100 : 0;
            const Icon = config.icon;
            return <Card key={pilar} className={cn('overflow-hidden transition-colors duration-200 hover:border-primary/25', config.card)}>
              <CardHeader className="pb-3"><div className="flex items-center gap-2.5"><span className={cn('flex h-9 w-9 items-center justify-center rounded-md', config.badge)}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span><CardTitle className="text-base">{config.label}</CardTitle></div></CardHeader>
              <CardContent className="space-y-4">
                <p className="min-h-10 text-xs leading-relaxed text-muted-foreground">{config.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>{formatMoney(realized)} realizado</span><span>{formatMoney(budgeted)} planejado</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-all duration-200', usage >= 100 ? 'bg-chart-expense' : config.progress)} style={{ width: `${Math.min(usage, 100)}%` }} /></div>
                  <p className={cn('text-right text-xs font-semibold', usage >= 100 ? 'text-destructive' : usage >= 80 ? 'text-warning' : 'text-muted-foreground')}>{usage.toFixed(0)}% utilizado</p>
                </div>
              </CardContent>
            </Card>;
          })}
        </div>
      </section>

      <MonthlyReflection storageKey={`kakebo:reflection:${usuario?.id ?? 'anonymous'}:${ano}-${String(mes).padStart(2, '0')}`} monthLabel={capitalizedMonth} />
    </>}
  </div>;
}

function HealthMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-0 rounded-md border bg-background/55 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 truncate font-display text-lg font-bold tabular-nums" title={value}>{value}</p><p className="truncate text-xs text-muted-foreground" title={detail}>{detail}</p></div>;
}
