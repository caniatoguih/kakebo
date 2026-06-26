import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transacoesService } from '@/services/transacoesService';
import { contasService } from '@/services/contasService';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ScrollText, TrendingUp, TrendingDown, DollarSign, Wallet, Eye, CheckCircle2, AlertCircle, Printer, Maximize2, Minimize2 } from 'lucide-react';

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
  // Modo de filtro: 'Personalizado' ou 'Anual'
  const [filtroModo, setFiltroModo] = useState<'Personalizado' | 'Anual'>('Anual');
  const [anoSelecionado, setAnoSelecionado] = useState<string>('2026');

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
  }, [filtroModo, anoSelecionado, startMonthCustom, endMonthCustom]);

  // Query das contas bancárias
  const { data: contas } = useQuery({
    queryKey: ['contas-list'],
    queryFn: () => contasService.listar(),
  });

  // Query React Query do DFC
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fluxo-contabil', startMonth, endMonth, statusFilter, contaSelecionada],
    queryFn: () => transacoesService.obterFluxoContabil(
      startMonth,
      endMonth,
      statusFilter,
      contaSelecionada === 'all' ? undefined : contaSelecionada
    ),
  });

  // Estados de expansão das categorias
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});

  const toggleCategory = (catName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
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
      allCats[cat.categoria_nome] = true;
    });
    dfc.saidas.forEach((cat: any) => {
      allCats[cat.categoria_nome] = true;
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
  const monthOptions = useMemo(() => {
    const options = [];
    const years = [2024, 2025, 2026, 2027];
    for (const y of years) {
      for (let m = 1; m <= 12; m++) {
        const value = `${y}-${String(m).padStart(2, '0')}`;
        options.push({
          value,
          label: `${String(m).padStart(2, '0')}/${y}`
        });
      }
    }
    return options;
  }, []);

  const yearOptions = ['2024', '2025', '2026', '2027'];

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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <ScrollText className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            Fluxo Contábil (DFC)
          </h1>
          <p className="text-muted-foreground">
            Demonstrativo de fluxo de caixa comparativo anual ou personalizado com projeções previstas e filtro de contas.
          </p>
        </div>

        {/* Painel de Filtros e Seletores */}
        <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm filter-section">
          
          {/* Seletor Realizado vs Previsto */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-400">Tipo de Fluxo</Label>
            <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200/55 dark:border-slate-800/60">
              <button
                onClick={() => setStatusFilter('Pago')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${statusFilter === 'Pago' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Realizado
              </button>
              <button
                onClick={() => setStatusFilter('Pendente')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${statusFilter === 'Pendente' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Previsto
              </button>
              <button
                onClick={() => setStatusFilter('Ambos')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${statusFilter === 'Ambos' ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <Eye className="h-3.5 w-3.5" />
                Ambos
              </button>
            </div>
          </div>

          {/* Divisor vertical em telas maiores */}
          <div className="hidden sm:block h-10 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Filtro de Conta Bancária */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <Label htmlFor="conta-filtro" className="text-xs font-semibold text-slate-400">Conta</Label>
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
          <div className="hidden sm:block h-10 w-px bg-slate-100 dark:bg-slate-800" />

          {/* Seletor de Modo de Filtro (Anual vs Custom) */}
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <Label htmlFor="filtro-modo" className="text-xs font-semibold text-slate-400">Modo Período</Label>
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
            <div className="flex flex-col gap-1.5 min-w-[100px]">
              <Label htmlFor="ano-selecionado" className="text-xs font-semibold text-slate-400">Ano</Label>
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
              <div className="flex flex-col gap-1.5 min-w-[110px]">
                <Label htmlFor="start-month" className="text-xs font-semibold text-slate-400">Início</Label>
                <Select value={startMonthCustom} onValueChange={setStartMonthCustom}>
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

              <div className="flex flex-col gap-1.5 min-w-[110px]">
                <Label htmlFor="end-month" className="text-xs font-semibold text-slate-400">Fim</Label>
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

        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
          <p className="text-muted-foreground text-sm font-semibold">Conciliando lançamentos e saldos...</p>
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/50 rounded-2xl">
          <p className="text-rose-600 dark:text-rose-400 font-semibold">Ocorreu um erro ao carregar o Fluxo Contábil.</p>
          <p className="text-xs text-muted-foreground mt-1">Verifique a conexão ou tente alterar as datas selecionadas.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 kpi-section no-print">
            <Card className="rounded-2xl border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900/30">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400">Patrimônio Consolidado</span>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(kpis.patrimonio)}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Saldo final acumulado em {formatMonthLabel(dfc.meses[dfc.meses.length - 1])}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Wallet className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900/30">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400">Resultado Líquido do Período</span>
                  <h3 className={`text-2xl font-bold ${kpis.resultadoPeriodo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(kpis.resultadoPeriodo)}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Entradas menos saídas no intervalo selecionado</p>
                </div>
                <div className={`p-3 rounded-xl ${kpis.resultadoPeriodo >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'}`}>
                  {kpis.resultadoPeriodo >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden bg-white dark:bg-slate-900/30">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400">Melhor Resultado Mensal</span>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(kpis.melhorMesValor)}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Superávit recorde em {formatMonthLabel(kpis.melhorMes)}</p>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <DollarSign className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DFC Grid Container */}
          <div
            id="dfc-table-container"
            className={
              isFullScreen
                ? "fixed inset-0 z-50 bg-white dark:bg-slate-950 p-6 flex flex-col overflow-hidden w-screen h-screen"
                : "bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm overflow-hidden"
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
                      <th key={m} className="py-4 px-4 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider min-w-[110px]">
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
                    const isExpanded = !!expandedCategories[cat.categoria_nome];
                    return (
                      <>
                        <tr
                          key={cat.categoria_nome}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors print-category-row"
                          onClick={() => toggleCategory(cat.categoria_nome)}
                        >
                          <td className="py-3 px-8 text-sm font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400 no-print flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400 no-print flex-shrink-0" />
                              )}
                              <span>{cat.categoria_nome}</span>
                            </div>
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
                              <td key={`${cat.categoria_nome}-${sub.subcategoria_nome}-${m}`} className="py-2.5 px-4 text-right text-[11px] text-slate-400 dark:text-slate-500">
                                {formatCurrency(sub.valores[m] ?? 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
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
                    const isExpanded = !!expandedCategories[cat.categoria_nome];
                    return (
                      <>
                        <tr
                          key={cat.categoria_nome}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors print-category-row"
                          onClick={() => toggleCategory(cat.categoria_nome)}
                        >
                          <td className="py-3 px-8 text-sm font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] z-10">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400 no-print flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400 no-print flex-shrink-0" />
                              )}
                              <span>{cat.categoria_nome}</span>
                            </div>
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
                              <td key={`${cat.categoria_nome}-${sub.subcategoria_nome}-${m}`} className="py-2.5 px-4 text-right text-[11px] text-slate-400 dark:text-slate-500">
                                {formatCurrency(sub.valores[m] ?? 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
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
