import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Target, Wallet, Sparkles, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { relatoriosService, type PainelReflexaoData } from '@/services/relatoriosService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';

const PILAR_CONFIG = {
  Sobrevivencia: {
    label: 'Sobrevivência',
    icon: Wallet,
    color: 'from-emerald-50/50 to-emerald-100/30 border-emerald-200/60 dark:from-emerald-950/20 dark:to-emerald-950/10 dark:border-emerald-900/20',
    barColor: '#059669', // emerald-600
    border: 'border-emerald-200/60 dark:border-emerald-900/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  Lazer: {
    label: 'Lazer',
    icon: Sparkles,
    color: 'from-violet-50/50 to-violet-100/30 border-violet-200/60 dark:from-violet-950/20 dark:to-violet-950/10 dark:border-violet-900/20',
    barColor: '#7c3aed', // violet-600
    border: 'border-violet-200/60 dark:border-violet-900/30',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
  Cultura: {
    label: 'Cultura',
    icon: BookOpen,
    color: 'from-amber-50/50 to-amber-100/30 border-amber-200/60 dark:from-amber-950/20 dark:to-amber-950/10 dark:border-amber-900/20',
    barColor: '#d97706', // amber-600
    border: 'border-amber-200/60 dark:border-amber-900/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  Extras: {
    label: 'Extras / Imprevistos',
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

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-semibold">{brl(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function Dashboard(): React.ReactElement {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const mes = currentDate.getMonth() + 1;
  const ano = currentDate.getFullYear();

  const { data, isLoading, isError } = useQuery<PainelReflexaoData>({
    queryKey: ['relatorio-reflexao', mes, ano],
    queryFn: () => relatoriosService.getPainelReflexao(mes, ano),
  });

  const prevMonth = () => setCurrentDate(new Date(ano, mes - 2, 1));
  const nextMonth = () => setCurrentDate(new Date(ano, mes, 1));

  const mesLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR });
  const mesCapitalized = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

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
          <Button variant={'ghost' as any} size={'sm' as any} onClick={prevMonth} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">{mesCapitalized}</span>
          <Button variant={'ghost' as any} size={'sm' as any} onClick={nextMonth} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Carregando reflexões...
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 rounded-lg">
          Erro ao carregar o painel. Verifique sua conexão.
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* Cards de Resumo */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Total Orçado
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{brl(data.resumo.total_orcado)}</div>
                <p className="text-xs text-muted-foreground mt-1">O que você planejou gastar.</p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Total Realizado
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${data.resumo.total_realizado > data.resumo.total_orcado ? 'text-red-500' : ''}`}>
                  {brl(data.resumo.total_realizado)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">O que realmente saiu do bolso.</p>
              </CardContent>
            </Card>

            <Card className={`border ${data.resumo.saldo_geral >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Balanço (Economia)
                </CardTitle>
                {data.resumo.saldo_geral >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${data.resumo.saldo_geral >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {brl(data.resumo.saldo_geral)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.resumo.saldo_geral >= 0 ? 'Sobrou neste mês. Excelente!' : 'Você ultrapassou o orçamento.'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico Principal */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Orçado × Realizado por Pilar</CardTitle>
              <CardDescription>Comparativo visual de como seu orçamento foi distribuído e consumido.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255, 255, 255, 0.05)'}} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                    <Bar dataKey="Orcado" name="Orçado" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-orc-${index}`} fill={entry.fillOrcado} />
                      ))}
                    </Bar>
                    <Bar dataKey="Realizado" name="Realizado" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-real-${index}`} fill={entry.fillRealizado} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

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
