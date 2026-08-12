import { Fragment, useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transacoesService } from '@/services/transacoesService';
import { contasService } from '@/services/contasService';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { QueryErrorState } from '@/components/QueryErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ScrollText, TrendingUp, TrendingDown, DollarSign, Wallet, Eye, CheckCircle2, AlertCircle, Printer, Maximize2, Minimize2 } from 'lucide-react';

// Formata valor monetário em BRL
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
};

// Formata string YYYY-MM para MM/YYYY ou Nome do Mês/Ano
const formatMonthLabel = (monthStr: string) => {
  if (!monthStr || monthStr === 'N/A') return monthStr || '';
  const [year, month] = monthStr.split('-');
  const monthsNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  return `${monthsNames[parseInt(month) - 1]} ${year}`;
};

export function FluxoContabil() {
  const currentMonth = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Modo de filtro: 'Personalizado' ou 'Anual'
  const [filtroModo, setFiltroModo] = useState<'Personalizado' | 'Anual'>('Anual');
  const [anoSelecionado, setAnoSelecionado] = useState<string>(() => String(new Date().getFullYear()));
  const [mobileMonth, setMobileMonth] = useState(currentMonth);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
  );

  // Filtro de status: 'Pago' (Realizado), 'Pendente' (Previsto), 'Ambos'
  const [statusFilter, setStatusFilter] = useState<'Pago' | 'Pendente' | 'Ambos'>('Ambos');

  // Filtro de conta bancária: 'all' (Todas) ou contaId
  const [contaSelecionada, setContaSelecionada] = useState<string>('all');

  // Modo Tela Cheia (Fullscreen)
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  // Define datas de início e fim baseadas no modo de filtro
  const [startMonthCustom, setStartMonthCustom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [endMonthCustom, setEndMonthCustom] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calcula startMonth e endMonth reais a serem passados para a API
  const { startMonth, endMonth } = useMemo(() => {
    if (isMobileViewport) {
      return { startMonth: mobileMonth, endMonth: mobileMonth };
    }
    if (filtroModo === 'Anual') {
      return {
        startMonth: `${anoSelecionado}-01`,
        endMonth: `${anoSelecionado}-12`
      };
    } else {
      return {
        startMonth: startMonthCustom,
        endMonth: endMonthCustom
      };
    }
  }, [isMobileViewport, mobileMonth, filtroModo, anoSelecionado, startMonthCustom, endMonthCustom]);

  // Query das contas bancárias
  const { data: contas } = useQuery({
    queryKey: ['contas-list'],
    queryFn: () => contasService.listar(),
  });

  // Query React Query do DFC
  const { data, isLoading, isError, isFetching, error: queryError, refetch } = useQuery({
    queryKey: ['fluxo-contabil', startMonth, endMonth, statusFilter, contaSelecionada],
    queryFn: () => transacoesService.obterFluxoContabil(
      startMonth,
      endMonth,
      statusFilter,
      contaSelecionada === 'all' ? undefined : contaSelecionada
    ),
    placeholderData: (previousData) =>
      !isMobileViewport || previousData?.meses?.includes(mobileMonth) ? previousData : undefined,
  });

  // Estados de expansão das categorias
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  // Funções de Expandir/Recolher Tudo
  const dfc = data || {
    meses: [],
    entradas: [],
    total_entradas: {},
    saidas: [],
    total_saidas: {},
    saldo_mes: {},
    saldo_anterior: {},
    saldo_acumulado: {}
  };

  const expandAll = () => {
    const allCats: { [key: string]: boolean } = {};
    dfc.entradas.forEach((cat: any) => {
      allCats[`entrada:${cat.categoria_nome}`] = true;
    });
    dfc.saidas.forEach((cat: any) => {
      allCats[`saida:${cat.categoria_nome}`] = true;
    });
    setExpandedCategories(allCats);
  };

  const collapseAll = () => {
    setExpandedCategories({});
  };

  // Função para abrir diálogo de impressão nativo
  const handlePrint = () => {
    window.print();
  };

  // Geração de opções de meses para os seletores
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => String(currentYear - 2 + index));
  }, []);

  const monthOptions = useMemo(() => {
    const options = [];
    for (const year of yearOptions) {
      const y = Number(year);
      for (let m = 1; m <= 12; m++) {
        const value = `${y}-${String(m).padStart(2, '0')}`;
        options.push({
          value,
          label: `${String(m).padStart(2, '0')}/${y}`
        });
      }
    }
    return options;
  }, [yearOptions]);

  const mobileMonthIndex = Math.max(0, monthOptions.findIndex((option) => option.value === mobileMonth));

  // Métricas do Topo
  const kpis = useMemo(() => {
    if (!data || !data.meses || data.meses.length === 0) {
      return { patrimonio: 0, resultadoPeriodo: 0, melhorMes: 'N/A', melhorMesValor: 0 };
    }

    const meses = data.meses;
    const ultimoMes = meses[meses.length - 1];
    const patrimonio = data.saldo_acumulado[ultimoMes] ?? 0;

    let totalEntradas = 0;
    let totalSaidas = 0;
    let melhorMes = 'N/A';
    let melhorMesValor = -Infinity;

    for (const m of meses) {
      totalEntradas += data.total_entradas[m] ?? 0;
      totalSaidas += data.total_saidas[m] ?? 0;

      const net = data.saldo_mes[m] ?? 0;
      if (net > melhorMesValor) {
        melhorMesValor = net;
        melhorMes = m;
      }
    }

    return {
      patrimonio,
      resultadoPeriodo: totalEntradas - totalSaidas,
      melhorMes,
      melhorMesValor
    };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Injeção de Estilos CSS Otimizados para Impressão */}
      <style>{`
        @media print {
          /* Esconder elementos desnecessários na folha impresso */
          aside, header, nav, .no-print, .kpi-section, .filter-section {
            display: none !important;
          }
          
          /* Forçar layout horizontal e margens mínimas */
          @page {
            size: landscape;
            margin: 0.3cm !important;
          }
          
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          main, .mx-auto, .max-w-6xl {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }

          #dfc-table-container {
            border: 1px solid #94a3b8 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid;
          }

          table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 5px 6px !important;
            font-size: 8px !important;
            line-height: 1.2 !important;
            min-width: 0 !important;
            width: auto !important;
          }

          /* Desativa o comportamento sticky para fluxo de impressão linear */
          .sticky {
            position: static !important;
            box-shadow: none !important;
          }

          /* Primeira coluna (Descrição Contábil) compactada e WRAPPED (não cortada) */
          th:first-child, td:first-child {
            width: 25% !important;
            font-weight: 700 !important;
            text-align: left !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow: visible !important;
            text-overflow: clip !important;
          }

          /* Colunas de meses perfeitamente distribuídas (75% / 12 = ~6.25%) */
          th:not(:first-child), td:not(:first-child) {
            width: 6.25% !important;
            text-align: right !important;
            white-space: nowrap !important;
          }

          /* --- ESTILIZAÇÃO COLORIDA PREMIUM PARA IMPRESSÃO --- */
          .print-header-row th {
            background-color: #f1f5f9 !important;
            color: #475569 !important;
          }

          .print-section-row td {
            background-color: #f8fafc !important;
            color: #0f172a !important;
            font-weight: bold !important;
          }

          .print-category-row td {
            background-color: #ffffff !important;
            color: #334155 !important;
          }

          .print-subcategory-row td {
            background-color: #fafafa !important;
            color: #64748b !important;
            font-style: italic !important;
          }

          .print-total-entradas-row td {
            background-color: #e8f5e9 !important;
            color: #2e7d32 !important;
            font-weight: bold !important;
          }

          .print-total-saidas-row td {
            background-color: #ffebee !important;
            color: #c62828 !important;
            font-weight: bold !important;
          }

          .print-saldo-mes-row td {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }

          .print-saldo-anterior-row td {
            background-color: #f8fafc !important;
            color: #475569 !important;
          }

          .print-saldo-acumulado-row td {
            background-color: #e3f2fd !important;
            color: #1565c0 !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="space-y-5 no-print">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <ScrollText className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            Visão Contábil (DFC)
          </h1>
          <p className="text-muted-foreground">
            Consolide saldos e movimentações por período. Para registrar e editar lançamentos, use o Fluxo de Caixa.
          </p>
        </div>

        {/* Painel de Filtros e Seletores */}
        <div className="grid w-full grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm filter-section dark:border-slate-800/80 dark:bg-slate-900 md:flex md:flex-wrap md:items-end">
          
          {/* Seletor Realizado vs Previsto */}
          <div className="flex min-w-0 flex-col gap-1.5 md:w-[360px]">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tipo de Fluxo</Label>
            <div className="grid w-full grid-cols-3 rounded-xl border border-slate-200/55 bg-slate-100 p-1 dark:border-slate-800/60 dark:bg-slate-950">
              <button
                onClick={() => setStatusFilter('Pago')}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === 'Pago' ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300' : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Realizado
              </button>
              <button
                onClick={() => setStatusFilter('Pendente')}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === 'Pendente' ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300' : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'}`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Previsto
              </button>
              <button
                onClick={() => setStatusFilter('Ambos')}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === 'Ambos' ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300' : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'}`}
              >
                <Eye className="h-3.5 w-3.5" />
                Ambos
              </button>
            </div>
          </div>

          {/* Divisor vertical em telas maiores */}
          {/* Filtro de Conta Bancária */}
          <div className="flex min-w-0 flex-col gap-1.5 md:min-w-[180px] md:flex-1">
            <Label htmlFor="conta-filtro" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Conta</Label>
            <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
              <SelectTrigger id="conta-filtro" className="rounded-xl border-slate-200 dark:border-slate-800 bg-transparent h-10 text-xs font-bold">
                <SelectValue placeholder="Todas as Contas" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas as Contas</SelectItem>
                {contas?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Divisor vertical */}
          {/* Seletor de Modo de Filtro (Anual vs Custom) */}
          <div className="hidden min-w-[180px] flex-col gap-1.5 md:flex">
            <Label htmlFor="filtro-modo" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Modo Período</Label>
            <Select value={filtroModo} onValueChange={(val: any) => setFiltroModo(val)}>
              <SelectTrigger id="filtro-modo" className="rounded-xl border-slate-200 dark:border-slate-800 bg-transparent h-10 text-xs font-bold">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="Anual">Ano Inteiro</SelectItem>
                <SelectItem value="Personalizado">Período Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seletores específicos com base no modo */}
          {filtroModo === 'Anual' ? (
            <div className="hidden min-w-[120px] flex-col gap-1.5 md:flex">
              <Label htmlFor="ano-selecionado" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ano</Label>
              <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                <SelectTrigger id="ano-selecionado" className="rounded-xl border-slate-200 dark:border-slate-800 bg-transparent h-10 text-xs font-bold">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="hidden min-w-[140px] flex-col gap-1.5 md:flex">
                <Label htmlFor="start-month" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Início</Label>
                <Select value={startMonthCustom} onValueChange={(value) => {
                  setStartMonthCustom(value);
                  if (endMonthCustom < value) setEndMonthCustom(value);
                }}>
                  <SelectTrigger id="start-month" className="rounded-xl border-slate-200 dark:border-slate-800 bg-transparent h-10 text-xs font-bold">
                    <SelectValue placeholder="Início" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl">
                    {monthOptions.map(opt => (
                      <SelectItem key={`start-${opt.value}`} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden min-w-[140px] flex-col gap-1.5 md:flex">
                <Label htmlFor="end-month" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Fim</Label>
                <Select value={endMonthCustom} onValueChange={(val) => setEndMonthCustom(val)}>
                  <SelectTrigger id="end-month" className="rounded-xl border-slate-200 dark:border-slate-800 bg-transparent h-10 text-xs font-bold">
                    <SelectValue placeholder="Fim" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl">
                    {monthOptions.map(opt => (
                      <SelectItem key={`end-${opt.value}`} value={opt.value} disabled={opt.value < startMonthCustom}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex min-w-0 flex-col gap-1.5 md:hidden">
            <Label htmlFor="mobile-month" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mês</Label>
            <Select value={mobileMonth} onValueChange={setMobileMonth}>
              <SelectTrigger id="mobile-month" className="h-11 rounded-xl border-slate-200 bg-transparent text-sm font-bold dark:border-slate-800">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl">
                {monthOptions.map((option) => (
                  <SelectItem key={`mobile-${option.value}`} value={option.value}>{formatMonthLabel(option.value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      {isFetching && !isLoading && (
        <div className="no-print flex items-center gap-2 text-xs font-medium text-slate-500" role="status" aria-live="polite">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Atualizando resultados…
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
          <p className="text-muted-foreground text-sm font-semibold">Conciliando lançamentos e saldos...</p>
        </div>
      ) : isError ? (
        <QueryErrorState error={queryError} title="Ocorreu um erro ao carregar o Fluxo Contábil." description="Verifique a conexão ou ajuste as datas selecionadas e tente novamente." retrying={isFetching} onRetry={() => refetch()} />
      ) : dfc.entradas.length === 0 && dfc.saidas.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nenhuma movimentação neste período" description="O fluxo contábil será montado quando houver receitas ou despesas no intervalo selecionado." action={<Button asChild><Link to="/transacoes">Registrar movimentação</Link></Button>} />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="hidden grid-cols-3 gap-4 kpi-section no-print md:grid">
            <Card className="rounded-2xl border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900/30">
              <CardContent className="flex items-center justify-between gap-2 p-4 md:p-6">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400">Saldo acumulado</span>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 md:text-2xl">
                    {formatCurrency(kpis.patrimonio)}
                  </h3>
                  <p className="hidden text-xs text-muted-foreground sm:block">Posição final em {formatMonthLabel(dfc.meses[dfc.meses.length - 1])}</p>
                </div>
                <div className="hidden rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 sm:block">
                  <Wallet className="h-5 w-5 md:h-6 md:w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900/30">
              <CardContent className="flex items-center justify-between gap-2 p-4 md:p-6">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400">Resultado Líquido do Período</span>
                  <h3 className={`text-lg font-bold md:text-2xl ${kpis.resultadoPeriodo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(kpis.resultadoPeriodo)}
                  </h3>
                  <p className="hidden text-xs text-muted-foreground sm:block">Entradas menos saídas no período</p>
                </div>
                <div className={`hidden p-3 rounded-xl sm:block ${kpis.resultadoPeriodo >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'}`}>
                  {kpis.resultadoPeriodo >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900/30">
              <CardContent className="flex items-center justify-between gap-2 p-4 md:p-6">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400">Melhor Resultado Mensal</span>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 md:text-2xl">
                    {formatCurrency(kpis.melhorMesValor)}
                  </h3>
                  <p className="text-xs text-muted-foreground">Superávit recorde em {formatMonthLabel(kpis.melhorMes)}</p>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <DollarSign className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Visão mensal otimizada para celular */}
          <section className="space-y-4 md:hidden no-print" aria-label="Resumo mensal do fluxo contábil">
            <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 w-11 rounded-xl p-0"
                  disabled={mobileMonthIndex === 0}
                  onClick={() => setMobileMonth(monthOptions[mobileMonthIndex - 1].value)}
                  aria-label="Ver mês anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resumo do mês</p>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatMonthLabel(mobileMonth)}</h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 w-11 rounded-xl p-0"
                  disabled={mobileMonthIndex >= monthOptions.length - 1}
                  onClick={() => setMobileMonth(monthOptions[mobileMonthIndex + 1].value)}
                  aria-label="Ver próximo mês"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <CardContent className="grid grid-cols-2 gap-3 p-4">
                <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Entradas</p>
                  <p className="mt-1 text-base font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(dfc.total_entradas[mobileMonth] ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/20">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Saídas</p>
                  <p className="mt-1 text-base font-bold text-rose-800 dark:text-rose-300">{formatCurrency(dfc.total_saidas[mobileMonth] ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Resultado</p>
                  <p className={`mt-1 text-base font-bold ${(dfc.saldo_mes[mobileMonth] ?? 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {(dfc.saldo_mes[mobileMonth] ?? 0) >= 0 ? '▲ ' : '▼ '}{formatCurrency(dfc.saldo_mes[mobileMonth] ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/20">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Saldo acumulado</p>
                  <p className="mt-1 text-base font-bold text-blue-800 dark:text-blue-300">{formatCurrency(dfc.saldo_acumulado[mobileMonth] ?? 0)}</p>
                </div>
              </CardContent>
            </Card>

            {([
              { key: 'entrada', title: 'Entradas (Receitas)', categories: dfc.entradas, total: dfc.total_entradas[mobileMonth] ?? 0, tone: 'emerald' },
              { key: 'saida', title: 'Saídas (Despesas)', categories: dfc.saidas, total: dfc.total_saidas[mobileMonth] ?? 0, tone: 'rose' },
            ] as const).map((section) => {
              const visibleCategories = section.categories.filter((category: any) => (category.valores[mobileMonth] ?? 0) !== 0);
              const isIncome = section.tone === 'emerald';

              return (
                <Card key={section.key} className="overflow-hidden rounded-2xl border-slate-200 shadow-sm dark:border-slate-800">
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${isIncome ? 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-950 dark:bg-emerald-950/20' : 'border-rose-100 bg-rose-50/70 dark:border-rose-950 dark:bg-rose-950/20'}`}>
                    <h2 className={`text-sm font-bold ${isIncome ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>{section.title}</h2>
                    <span className={`text-sm font-bold ${isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(section.total)}</span>
                  </div>

                  {visibleCategories.length === 0 ? (
                    <p className="px-4 py-5 text-center text-sm text-muted-foreground">Nenhum valor neste mês.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visibleCategories.map((category: any) => {
                        const categoryKey = `${section.key}:${category.categoria_nome}`;
                        const isExpanded = !!expandedCategories[categoryKey];
                        const visibleSubcategories = category.subcategorias.filter((subcategory: any) => (subcategory.valores[mobileMonth] ?? 0) !== 0);

                        return (
                          <div key={categoryKey}>
                            <button
                              type="button"
                              className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:hover:bg-slate-800/40"
                              onClick={() => toggleCategory(categoryKey)}
                              aria-expanded={isExpanded}
                              aria-controls={`mobile-${categoryKey.replace(/[^a-zA-Z0-9]/g, '-')}`}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{category.categoria_nome}</span>
                              <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(category.valores[mobileMonth] ?? 0)}</span>
                            </button>
                            {isExpanded && (
                              <div id={`mobile-${categoryKey.replace(/[^a-zA-Z0-9]/g, '-')}`} className="bg-slate-50/70 px-4 py-2 dark:bg-slate-950/30">
                                {visibleSubcategories.length === 0 ? (
                                  <p className="py-2 pl-7 text-xs text-muted-foreground">Sem detalhamento para este mês.</p>
                                ) : visibleSubcategories.map((subcategory: any) => (
                                  <div key={subcategory.subcategoria_nome} className="flex items-center justify-between gap-3 py-2 pl-7 text-xs">
                                    <span className="text-slate-500 dark:text-slate-400">{subcategory.subcategoria_nome}</span>
                                    <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(subcategory.valores[mobileMonth] ?? 0)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              Saldo anterior: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(dfc.saldo_anterior[mobileMonth] ?? 0)}</strong>
              <span className="mx-2" aria-hidden="true">•</span>
              {statusFilter === 'Pago' ? 'Realizado' : statusFilter === 'Pendente' ? 'Previsto' : 'Realizado + previsto'}
            </div>
          </section>

          {/* DFC Grid Container */}
          <div
            id="dfc-table-container"
            className={
              isFullScreen
                ? "fixed inset-0 z-50 bg-white dark:bg-slate-950 p-6 flex flex-col overflow-hidden w-screen h-screen"
                : "hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden md:block"
            }
          >
            
            {/* Tabela Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800/80 no-print">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Visualizando {dfc.meses.length} meses ({statusFilter === 'Pago' ? 'Apenas Realizado' : statusFilter === 'Pendente' ? 'Apenas Previsto' : 'Realizado + Previsto'}) 
                {contaSelecionada !== 'all' && <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">• Conta Filtrada</span>}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={expandAll} className="h-8 px-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 rounded-lg">
                  Expandir Tudo
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="h-8 px-2 text-xs font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg">
                  Recolher Tudo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="h-8 px-2.5 text-xs font-bold border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950/45 rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {isFullScreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 px-2.5 text-xs font-bold border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950/45 rounded-lg flex items-center gap-1.5 shadow-sm">
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
              </div>
            </div>

            <div className={`overflow-x-auto ${isFullScreen ? 'flex-1 overflow-y-auto mt-4 border border-slate-100 dark:border-slate-800 rounded-xl' : ''}`}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50 print-header-row">
                    <th className="py-4 px-6 text-left text-xs font-bold text-slate-400 tracking-wider min-w-[240px] sticky left-0 bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                      Descrição Contábil
                    </th>
                    {dfc.meses.map((m: string) => (
                      <th key={m} className="py-4 px-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider min-w-[110px]">
                        {formatMonthLabel(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* --- ENTRADAS SECTION --- */}
                  <tr className="bg-slate-50/30 dark:bg-slate-900/30 print-section-row">
                    <td className="py-3 px-6 font-bold text-sm text-slate-800 dark:text-slate-100 sticky left-0 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                      1. Entradas (Receitas)
                    </td>
                    {dfc.meses.map((m: string) => (
                      <td key={`space-entradas-${m}`} className="py-3 px-4"></td>
                    ))}
                  </tr>

                  {dfc.entradas.map((cat: any) => {
                    const categoryKey = `entrada:${cat.categoria_nome}`;
                    const isExpanded = !!expandedCategories[categoryKey];
                    return (
                      <Fragment key={`entrada-${cat.categoria_nome}`}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors print-category-row">
                          <td className="py-0 px-0 text-sm font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                            <button type="button" className="flex min-h-11 w-full items-center gap-2 px-8 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500" onClick={() => toggleCategory(categoryKey)} aria-expanded={isExpanded}>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400 no-print flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400 no-print flex-shrink-0" />
                              )}
                              <span>{cat.categoria_nome}</span>
                            </button>
                          </td>
                          {dfc.meses.map((m: string) => (
                            <td key={`${cat.categoria_nome}-${m}`} className="py-3 px-4 text-right text-xs text-slate-600 dark:text-slate-300 font-semibold">
                              {formatCurrency(cat.valores[m] ?? 0)}
                            </td>
                          ))}
                        </tr>

                        {isExpanded && cat.subcategorias.map((sub: any) => (
                          <tr key={`${cat.categoria_nome}-${sub.subcategoria_nome}`} className="bg-slate-50/10 dark:bg-slate-900/10 border-none print-subcategory-row">
                            <td className="py-2.5 px-14 text-xs text-slate-400 dark:text-slate-400 italic sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                              {sub.subcategoria_nome}
                            </td>
                            {dfc.meses.map((m: string) => (
                              <td key={`${cat.categoria_nome}-${sub.subcategoria_nome}-${m}`} className="py-2.5 px-4 text-right text-xs text-slate-400 dark:text-slate-500">
                                {formatCurrency(sub.valores[m] ?? 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}

                  <tr className="bg-emerald-50/20 dark:bg-emerald-950/10 font-bold border-t-2 border-slate-200 dark:border-slate-700 print-total-entradas-row">
                    <td className="py-3.5 px-6 text-sm text-emerald-700 dark:text-emerald-400 sticky left-0 bg-emerald-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                      Total de Entradas (A)
                    </td>
                    {dfc.meses.map((m: string) => (
                      <td key={`total-entradas-${m}`} className="py-3.5 px-4 text-right text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                        {formatCurrency(dfc.total_entradas[m] ?? 0)}
                      </td>
                    ))}
                  </tr>

                  {/* --- SAIDAS SECTION --- */}
                  <tr className="bg-slate-50/30 dark:bg-slate-900/30 print-section-row">
                    <td className="py-3 px-6 font-bold text-sm text-slate-800 dark:text-slate-100 sticky left-0 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                      2. Saídas (Despesas)
                    </td>
                    {dfc.meses.map((m: string) => (
                      <td key={`space-saidas-${m}`} className="py-3 px-4"></td>
                    ))}
                  </tr>

                  {dfc.saidas.map((cat: any) => {
                    const categoryKey = `saida:${cat.categoria_nome}`;
                    const isExpanded = !!expandedCategories[categoryKey];
                    return (
                      <Fragment key={`saida-${cat.categoria_nome}`}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors print-category-row">
                          <td className="py-0 px-0 text-sm font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                            <button type="button" className="flex min-h-11 w-full items-center gap-2 px-8 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500" onClick={() => toggleCategory(categoryKey)} aria-expanded={isExpanded}>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400 no-print flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400 no-print flex-shrink-0" />
                              )}
                              <span>{cat.categoria_nome}</span>
                            </button>
                          </td>
                          {dfc.meses.map((m: string) => (
                            <td key={`${cat.categoria_nome}-${m}`} className="py-3 px-4 text-right text-xs text-slate-600 dark:text-slate-300 font-semibold">
                              {formatCurrency(cat.valores[m] ?? 0)}
                            </td>
                          ))}
                        </tr>

                        {isExpanded && cat.subcategorias.map((sub: any) => (
                          <tr key={`${cat.categoria_nome}-${sub.subcategoria_nome}`} className="bg-slate-50/10 dark:bg-slate-900/10 border-none print-subcategory-row">
                            <td className="py-2.5 px-14 text-xs text-slate-400 dark:text-slate-400 italic sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                              {sub.subcategoria_nome}
                            </td>
                            {dfc.meses.map((m: string) => (
                              <td key={`${cat.categoria_nome}-${sub.subcategoria_nome}-${m}`} className="py-2.5 px-4 text-right text-xs text-slate-400 dark:text-slate-500">
                                {formatCurrency(sub.valores[m] ?? 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}

                  <tr className="bg-rose-50/20 dark:bg-rose-950/10 font-bold border-t-2 border-slate-200 dark:border-slate-700 print-total-saidas-row">
                    <td className="py-3.5 px-6 text-sm text-rose-700 dark:text-rose-400 sticky left-0 bg-rose-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                      Total de Saídas (B)
                    </td>
                    {dfc.meses.map((m: string) => (
                      <td key={`total-saidas-${m}`} className="py-3.5 px-4 text-right text-xs text-rose-700 dark:text-rose-400 font-bold">
                        {formatCurrency(dfc.total_saidas[m] ?? 0)}
                      </td>
                    ))}
                  </tr>

                  {/* --- SUMMARY SECTION --- */}
                  <tr className="bg-slate-100/50 dark:bg-slate-950/40 font-bold border-t-4 border-slate-300 dark:border-slate-700 print-saldo-mes-row">
                    <td className="py-3.5 px-6 text-sm text-slate-800 dark:text-slate-100 sticky left-0 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                      Saldo do Mês (A - B)
                    </td>
                    {dfc.meses.map((m: string) => {
                      const val = dfc.saldo_mes[m] ?? 0;
                      return (
                        <td key={`saldo-mes-${m}`} className={`py-3.5 px-4 text-right text-xs ${val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatCurrency(val)}
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="bg-slate-50/20 dark:bg-slate-950/20 font-bold print-saldo-anterior-row">
                    <td className="py-3.5 px-6 text-sm text-slate-500 dark:text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                      Saldo Anterior (Acumulado)
                    </td>
                    {dfc.meses.map((m: string) => (
                      <td key={`saldo-anterior-${m}`} className="py-3.5 px-4 text-right text-xs text-slate-500 dark:text-slate-400 font-semibold">
                        {formatCurrency(dfc.saldo_anterior[m] ?? 0)}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-emerald-50/20 dark:bg-emerald-950/10 font-bold border-b-2 border-emerald-500 print-saldo-acumulado-row">
                    <td className="py-4 px-6 text-sm text-emerald-700 dark:text-emerald-400 sticky left-0 bg-emerald-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                      Saldo Acumulado (Patrimônio)
                    </td>
                    {dfc.meses.map((m: string) => (
                      <td key={`saldo-acumulado-${m}`} className="py-4 px-4 text-right text-xs text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                        {formatCurrency(dfc.saldo_acumulado[m] ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
