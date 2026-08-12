import React, { Suspense, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Target, Wallet, Sparkles, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QueryErrorState } from '@/components/QueryErrorState';
import { EmptyState } from '@/components/EmptyState';
import { SetupChecklist } from '@/components/SetupChecklist';
import { relatoriosService, type PainelReflexaoData } from '@/services/relatoriosService';
import { contasService } from '@/services/contasService';
import { orcamentosService } from '@/services/orcamentosService';
import { transacoesService } from '@/services/transacoesService';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { FinancialTrendChart } from '@/components/FinancialTrendChart';
import { BudgetDeviationChart } from '@/components/BudgetDeviationChart';

const BudgetComparisonChart = React.lazy(() => import('@/components/BudgetComparisonChart').then((module) => ({ default: module.BudgetComparisonChart })));

const PILAR_CONFIG = {
  Sobrevivencia: {
    label: 'Sobrevivência',
    description: 'Moradia, alimentação, saúde e necessidades essenciais.',
    icon: Wallet,
    color: 'from-emerald-50/50 to-emerald-100/30 border-emerald-200/60 dark:from-emerald-950/20 dark:to-emerald-950/10 dark:border-emerald-900/20',
    barColor: '#059669', // emerald-600
    border: 'border-emerald-200/60 dark:border-emerald-900/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  Lazer: {
    label: 'Lazer',
    description: 'Diversão, passeios e experiências que trazem bem-estar.',
    icon: Sparkles,
    color: 'from-violet-50/50 to-violet-100/30 border-violet-200/60 dark:from-violet-950/20 dark:to-violet-950/10 dark:border-violet-900/20',
    barColor: '#7c3aed', // violet-600
    border: 'border-violet-200/60 dark:border-violet-900/30',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
  Cultura: {
    label: 'Cultura',
    description: 'Educação, livros e atividades para seu desenvolvimento.',
    icon: BookOpen,
    color: 'from-amber-50/50 to-amber-100/30 border-amber-200/60 dark:from-amber-950/20 dark:to-amber-950/10 dark:border-amber-900/20',
    barColor: '#d97706', // amber-600
    border: 'border-amber-200/60 dark:border-amber-900/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  Extras: {
    label: 'Extras / Imprevistos',
    description: 'Gastos inesperados e despesas fora da rotina.',
    icon: TrendingUp,
    color: 'from-rose-50/50 to-rose-100/30 border-rose-200/60 dark:from-rose-950/20 dark:to-rose-950/10 dark:border-rose-900/20',
    barColor: '#e11d48', // rose-600
    border: 'border-rose-200/60 dark:border-rose-900/30',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
} as const;

type Pilar = keyof typeof PILAR_CONFIG;
const PILAR_ORDER: Pilar[] = ['Sobrevivencia', 'Lazer', 'Cultura', 'Extras'];

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const decimal = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
const percent = (value: number | null) => value === null ? '—' : `${decimal(value)}%`;

function Comparison({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">Sem base no mês anterior</span>;
  const favorable = inverse ? value <= 0 : value >= 0;
  return <span className={`text-xs font-medium ${favorable ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
    {value >= 0 ? '▲' : '▼'} {Math.abs(value).toFixed(0)}% vs. mês anterior
  </span>;
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

  const prevMonth = () => setCurrentDate(new Date(ano, mes - 2, 1));
  const nextMonth = () => setCurrentDate(new Date(ano, mes, 1));

  const mesLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR });
  const mesCapitalized = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
  const hasMonthlyData = !!data && (data.resumo.total_orcado !== 0 || data.resumo.total_realizado !== 0);

  // Formatar dados para o gráfico principal
  const chartData = useMemo(() => {
    if (!data) return [];
    return PILAR_ORDER.map(pilar => {
      const pData = data.pilares[pilar];
      return {
        name: PILAR_CONFIG[pilar].label,
        Orcado: pData?.orcado || 0,
        Realizado: pData?.realizado || 0,
        fillOrcado: PILAR_CONFIG[pilar].barColor + '80', // mais transparente para orçado
        fillRealizado: PILAR_CONFIG[pilar].barColor, // sólido para realizado
      };
    });
  }, [data]);

  return (
    <div className="space-y-8">
      {/* Header & Navegação de Mês */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reflexão Kakebo</h1>
          <p className="text-muted-foreground">O coração do Kakebo: analise como você viveu este mês.</p>
        </div>
        
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1">
          <Button aria-label="Mês anterior" variant={'ghost' as any} size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">{mesCapitalized}</span>
          <Button aria-label="Próximo mês" variant={'ghost' as any} size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {setupReady && <SetupChecklist
        hasAccount={(accountsSetupQuery.data?.length ?? 0) > 0}
        hasCategory={categoriesReviewed}
        hasBudget={(budgetsSetupQuery.data?.length ?? 0) > 0}
        hasTransaction={(transactionsSetupQuery.data?.total ?? 0) > 0}
      />}

      {isLoading && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Carregando reflexões...
        </div>
      )}

      {isError && <QueryErrorState error={queryError} title="Erro ao carregar o painel." retrying={isFetching} onRetry={() => refetch()} className="min-h-64" />}

      {!isLoading && !isError && data && (
        <>
          {/* Indicadores financeiros principais */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores financeiros do mês">
            <Card className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 md:p-5 md:pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receitas</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent className="p-4 pt-0 md:p-5 md:pt-0">
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 md:text-2xl">{brl(data.resumo.receitas_realizadas)}</div>
                <Comparison value={data.comparacao_mes_anterior.receitas_percentual} />
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 md:p-5 md:pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Despesas</CardTitle>
                <TrendingDown className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0 md:p-5 md:pt-0">
                <div className="text-xl font-bold md:text-2xl">{brl(data.resumo.despesas_realizadas)}</div>
                <Comparison value={data.comparacao_mes_anterior.despesas_percentual} inverse />
                {data.resumo.despesas_previstas > 0 && <p className="mt-1 text-xs text-muted-foreground">+ {brl(data.resumo.despesas_previstas)} previsto</p>}
              </CardContent>
            </Card>

            <Card className={`border ${data.resumo.resultado_real >= 0 ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/20'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 md:p-5 md:pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultado real</CardTitle>
                {data.resumo.resultado_real >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-700" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
              </CardHeader>
              <CardContent className="p-4 pt-0 md:p-5 md:pt-0">
                <div className={`text-xl font-bold md:text-2xl ${data.resumo.resultado_real >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{brl(data.resumo.resultado_real)}</div>
                <p className="text-xs text-muted-foreground">Receitas menos despesas pagas</p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 md:p-5 md:pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxa de poupança</CardTitle>
                <Target className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0 md:p-5 md:pt-0">
                <div className="text-xl font-bold md:text-2xl">{percent(data.resumo.taxa_poupanca)}</div>
                <p className="text-xs text-muted-foreground">Parcela da renda preservada</p>
              </CardContent>
            </Card>
          </section>

          {data.insights.length > 0 && <section className="space-y-3" aria-labelledby="insights-title">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /><h2 id="insights-title" className="text-lg font-semibold">Insights do mês</h2></div>
            <div className="grid gap-3 lg:grid-cols-3">
              {data.insights.map((insight) => <Card key={insight.titulo} className={insight.tipo === 'atencao' ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20' : insight.tipo === 'positivo' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' : 'bg-card'}>
                <CardContent className="p-4">
                  <h3 className="font-semibold">{insight.titulo}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{insight.descricao}</p>
                  {insight.destino && <Button asChild variant="link" className="mt-2 h-auto p-0"><Link to={insight.destino}>Ver detalhes →</Link></Button>}
                </CardContent>
              </Card>)}
            </div>
          </section>}

          <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <Card className="min-w-0">
              <CardHeader><CardTitle>Evolução financeira</CardTitle><CardDescription>Receitas e despesas efetivamente realizadas nos últimos seis meses.</CardDescription></CardHeader>
              <CardContent><FinancialTrendChart data={data.historico} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Maiores desvios</CardTitle><CardDescription>Categorias que mais se afastaram do planejamento.</CardDescription></CardHeader>
              <CardContent><BudgetDeviationChart data={data.desvios} /></CardContent>
            </Card>
          </section>

          {/* Gráfico Principal */}
          {hasMonthlyData ? <Card className="min-w-0 border-border">
            <CardHeader>
              <CardTitle>Orçado × Realizado por Pilar</CardTitle>
              <CardDescription>Comparativo visual de como seu orçamento foi distribuído e consumido.</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="mt-4 h-[350px] animate-pulse rounded-xl bg-muted" aria-label="Carregando gráfico" />}><BudgetComparisonChart data={chartData} /></Suspense>
            </CardContent>
          </Card> : <EmptyState icon={Target} title="Ainda não há dados para comparar neste mês" description="Crie um orçamento e registre movimentações para visualizar o comparativo entre o planejado e o realizado." action={<><Button asChild variant="outline"><Link to="/planejamento">Planejar o mês</Link></Button><Button asChild><Link to="/transacoes">Registrar movimentação</Link></Button></>} />}

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Projeção e saúde financeira">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div><CardTitle>Projeção de fechamento</CardTitle><CardDescription>Estimativa baseada no ritmo atual e nos compromissos pendentes.</CardDescription></div>
                <Target className="h-5 w-5 shrink-0 text-indigo-500" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40"><p className="text-xs text-muted-foreground">Despesas projetadas</p><p className="mt-1 font-bold">{brl(data.projecao.despesas_projetadas)}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/40"><p className="text-xs text-muted-foreground">Resultado projetado</p><p className={`mt-1 font-bold ${data.projecao.resultado_projetado >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{brl(data.projecao.resultado_projetado)}</p></div>
                </div>
                {data.projecao.percentual_orcamento_projetado !== null && <div>
                  <div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Consumo projetado do orçamento</span><strong>{percent(data.projecao.percentual_orcamento_projetado)}</strong></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${data.projecao.percentual_orcamento_projetado > 100 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, data.projecao.percentual_orcamento_projetado)}%` }} /></div>
                </div>}
                <p className="text-xs text-muted-foreground">{brl(data.projecao.compromissos_pendentes)} em despesas previstas. Projeções são estimativas, não garantias.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Saúde financeira</CardTitle><CardDescription>Sinais de comprometimento, crédito e proteção financeira.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Essenciais / renda</p><p className="mt-2 text-lg font-bold">{percent(data.saude.percentual_renda_essenciais)}</p><p className="text-xs text-muted-foreground">{brl(data.saude.despesas_essenciais)}</p></div>
                <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Recorrências / renda</p><p className="mt-2 text-lg font-bold">{percent(data.saude.percentual_renda_recorrencias)}</p><p className="text-xs text-muted-foreground">{brl(data.saude.compromissos_recorrentes)}</p></div>
                <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Uso dos cartões</p><p className="mt-2 text-lg font-bold">{percent(data.saude.utilizacao_cartoes)}</p><p className="text-xs text-muted-foreground">{brl(data.saude.faturas_abertas)} em aberto</p></div>
                <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Cobertura da reserva</p><p className="mt-2 text-lg font-bold">{data.saude.meses_cobertura === null ? '—' : `${decimal(data.saude.meses_cobertura)} meses`}</p><p className="text-xs text-muted-foreground">{brl(data.saude.reserva)} em poupança</p></div>
              </CardContent>
            </Card>
          </section>

          {/* Detalhamento dos Pilares */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">Detalhamento dos Pilares</h3>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {PILAR_ORDER.map(pilar => {
                const config = PILAR_CONFIG[pilar];
                const pData = data.pilares[pilar];
                const pct = pData?.orcado > 0 ? (pData.realizado / pData.orcado) * 100 : 0;
                const cappedPct = Math.min(pct, 100);
                const Icon = config.icon;
                
                return (
                  <Card key={pilar} className={`border shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br ${config.color} backdrop-blur-md transition-shadow duration-300 hover:shadow-md`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl shadow-sm ${config.badge}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <CardTitle className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">{config.label}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4">
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                          <span>{brl(pData?.realizado || 0)} realizado</span>
                          <span>{brl(pData?.orcado || 0)} orçado</span>
                        </div>
                        <div className="relative h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800/70 overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-500`}
                            style={{ 
                              width: `${cappedPct}%`, 
                              backgroundColor: pct >= 100 ? '#e11d48' : config.barColor 
                            }}
                          />
                        </div>
                        <div className="mt-2 text-right text-xs font-bold">
                          <span className={pct >= 100 ? 'text-rose-600 dark:text-rose-400' : pct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}>
                            {pct.toFixed(0)}% utilizado
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
