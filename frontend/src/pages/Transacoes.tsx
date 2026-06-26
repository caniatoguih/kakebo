import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transacoesService, type TransacaoData } from '@/services/transacoesService';
import { contasService } from '@/services/contasService';
import { NovaTransacaoModal } from '@/components/Transacoes/NovaTransacaoModal';
import { ImportarCSVModal } from '@/components/Transacoes/ImportarCSVModal';
import { SincronizarOFXModal } from '@/components/Transacoes/SincronizarOFXModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Search, Filter, CreditCard, CheckCircle2, Clock, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export function Transacoes() {
  // Query de transações históricas (limite alto para busca rápida)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['transacoes'],
    queryFn: () => transacoesService.listar({ limit: 1000 }),
  });

  // Query de contas para popular o filtro de contas
  const { data: contas = [] } = useQuery<any[]>({
    queryKey: ['contas'],
    queryFn: contasService.listar,
  });

  const queryClient = useQueryClient();

  // Estados dos filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [contaFilter, setContaFilter] = useState<string>('Todos');
  const [periodFilter, setPeriodFilter] = useState<string>('Este Mes');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const toggleMutation = useMutation({
    mutationFn: (id: string) => transacoesService.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Erro ao alterar status da transação.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transacoesService.excluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Erro ao excluir transação.');
    }
  });

  const handleDelete = (id: string, descricao: string) => {
    if (confirm(`Deseja realmente excluir a transação "${descricao}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Estado local para transações selecionadas
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const deleteBatchMutation = useMutation({
    mutationFn: (ids: string[]) => transacoesService.excluirEmLote(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
      setSelectedIds([]);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Erro ao excluir transações selecionadas.');
    }
  });

  const handleDeleteBatch = () => {
    if (confirm(`Deseja realmente excluir as ${selectedIds.length} transações selecionadas e reverter seus impactos nos saldos das contas?`)) {
      deleteBatchMutation.mutate(selectedIds);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const listaTransacoes = data?.transacoes || [];

  // Motor de filtros em tempo real no cliente (instântaneo e super leve)
  const filteredTransacoes = useMemo(() => {
    let result = [...listaTransacoes];

    // 1. Busca por termo de descrição
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => t.descricao.toLowerCase().includes(lower));
    }

    // 2. Filtro por status (Pago vs Pendente)
    if (statusFilter !== 'Todos') {
      result = result.filter(t => t.status === statusFilter);
    }

    // 3. Filtro por conta de lançamento
    if (contaFilter !== 'Todos') {
      result = result.filter(t => t.conta_id === contaFilter);
    }

    // 4. Filtro por período temporal
    const now = new Date();
    const contasMap = new Map(contas.map((c: any) => [c.id, c]));

    const getTransactionPaymentMonthAndYear = (t: any): { month: number; year: number } => {
      const conta = contasMap.get(t.conta_id);
      const isInvoicePayment = (descricao: string): boolean => {
        const descLower = (descricao || '').toLowerCase();
        return descLower.includes('pagamento fatura') || descLower.includes('liquidação fatura') || descLower.includes('liquidacao fatura');
      };

      if (conta?.tipo === 'CartaoCredito' && conta.cartao_detalhe && !isInvoicePayment(t.descricao)) {
        const diaFechamento = conta.cartao_detalhe.dia_fechamento;
        const d = new Date(t.data_transacao);
        const day = d.getUTCDate();
        let year = d.getUTCFullYear();
        let month = d.getUTCMonth(); // 0-indexed

        if (day >= diaFechamento) {
          month += 1;
          if (month > 11) {
            month = 0;
            year += 1;
          }
        }

        // Pagamento ocorre sempre no mês seguinte
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }

        return { month, year };
      } else {
        const d = new Date(t.data_transacao);
        return { month: d.getUTCMonth(), year: d.getUTCFullYear() };
      }
    };

    if (periodFilter === 'Este Mes') {
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed
      result = result.filter(t => {
        const { month, year } = getTransactionPaymentMonthAndYear(t);
        return year === currentYear && month === currentMonth;
      });
    } else if (periodFilter === 'MesEspecifico') {
      if (selectedMonth) {
        const [yearStr, monthStr] = selectedMonth.split('-');
        const targetYear = parseInt(yearStr);
        const targetMonth = parseInt(monthStr) - 1; // 0-indexed
        result = result.filter(t => {
          const { month, year } = getTransactionPaymentMonthAndYear(t);
          return year === targetYear && month === targetMonth;
        });
      }
    } else if (periodFilter === '30dias') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      result = result.filter(t => {
        const d = new Date(t.data_transacao);
        return d >= thirtyDaysAgo && d <= now;
      });
    } else if (periodFilter === 'Personalizado') {
      if (customStartDate) {
        const start = new Date(customStartDate + 'T00:00:00');
        result = result.filter(t => new Date(t.data_transacao) >= start);
      }
      if (customEndDate) {
        const end = new Date(customEndDate + 'T23:59:59');
        result = result.filter(t => new Date(t.data_transacao) <= end);
      }
    }

    // Ordenação garantida por data decrescente
    return result.sort((a, b) => new Date(b.data_transacao).getTime() - new Date(a.data_transacao).getTime());
  }, [listaTransacoes, searchTerm, statusFilter, contaFilter, periodFilter, customStartDate, customEndDate, selectedMonth]);

  const visibleIds = useMemo(() => filteredTransacoes.map(t => t.id).filter((id): id is string => !!id), [filteredTransacoes]);

  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const someSelected = visibleIds.some(id => selectedIds.includes(id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleIds);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">Monitore e filtre suas receitas, despesas e transferências.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <SincronizarOFXModal />
          <ImportarCSVModal />
          <NovaTransacaoModal />
        </div>
      </div>

      {/* Painel de Filtros Avançados (SaaS Premium Style com Collapse) */}
      <Card className="border border-slate-200/50 dark:border-slate-800/60 shadow-sm bg-card rounded-2xl transition-all duration-300">
        <CardContent className="p-5">
          {/* Header clicável para toggle collapse */}
          <div 
            className={`flex items-center justify-between cursor-pointer select-none transition-all duration-300 ${
              showFilters ? 'pb-3 border-b border-slate-100 dark:border-slate-800/60' : ''
            }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Filtros de Busca</h3>
            </div>
            <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
              {showFilters ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
            </div>
          </div>

          {showFilters && (
            <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Campo 1: Termo de Busca */}
                <div className="space-y-1.5">
                  <Label htmlFor="search" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Descrição</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="search"
                      placeholder="Buscar transação..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-10 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/80 focus-visible:ring-emerald-600"
                    />
                  </div>
                </div>

                {/* Campo 2: Filtro de Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/80 focus:ring-emerald-600">
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                      <SelectItem value="Todos" className="rounded-lg">Todos os Status</SelectItem>
                      <SelectItem value="Pago" className="rounded-lg">Pago</SelectItem>
                      <SelectItem value="Pendente" className="rounded-lg">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Campo 3: Filtro de Conta */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Conta Bancária</Label>
                  <Select value={contaFilter} onValueChange={setContaFilter}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/80 focus:ring-emerald-600">
                      <SelectValue placeholder="Todas as Contas" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                      <SelectItem value="Todos" className="rounded-lg">Todas as Contas</SelectItem>
                      {contas.map((c) => (
                        <SelectItem key={c.id} value={c.id!} className="rounded-lg">
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Campo 4: Período de Datas */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Período</Label>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/80 focus:ring-emerald-600">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                      <SelectItem value="Todos" className="rounded-lg">Todo o Histórico</SelectItem>
                      <SelectItem value="Este Mes" className="rounded-lg">Mês Atual</SelectItem>
                      <SelectItem value="MesEspecifico" className="rounded-lg">Selecionar Mês</SelectItem>
                      <SelectItem value="30dias" className="rounded-lg">Últimos 30 Dias</SelectItem>
                      <SelectItem value="Personalizado" className="rounded-lg">Período Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seletor de Mês Específico */}
              {periodFilter === 'MesEspecifico' && (
                <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/50 transition-all duration-300 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5 flex-1">
                    <Label htmlFor="monthSelect" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Escolha o Mês e Ano</Label>
                    <Input
                      id="monthSelect"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="h-10 rounded-xl bg-background border-slate-200/60 dark:border-slate-800/80"
                    />
                  </div>
                </div>
              )}

              {/* Inputs de Data Customizados (exibidos condicionalmente) */}
              {periodFilter === 'Personalizado' && (
                <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/50 transition-all duration-300 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5 flex-1">
                    <Label htmlFor="startDate" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data Inicial</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-10 rounded-xl bg-background border-slate-200/60 dark:border-slate-800/80"
                    />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <Label htmlFor="endDate" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Data Final</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-10 rounded-xl bg-background border-slate-200/60 dark:border-slate-800/80"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Transações */}
      <Card className="border border-slate-200/50 dark:border-slate-800/60 shadow-sm rounded-2xl overflow-hidden bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/40">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => {
                      if (input) {
                        input.indeterminate = someSelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                  />
                </TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Data</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Descrição</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Conta</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Tipo</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300">Status</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-right">Valor</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-center w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-32 text-slate-400 font-semibold">
                    Carregando transações...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-32 text-rose-500 font-semibold">
                    Erro ao carregar dados. (Verifique sua conexão / Token JWT)
                  </TableCell>
                </TableRow>
              ) : filteredTransacoes.length > 0 ? (
                filteredTransacoes.map((t: TransacaoData) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors">
                    <TableCell className="text-center w-12">
                      {t.id && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id)}
                          onChange={() => handleSelectOne(t.id!)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-300 font-medium">
                      {format(new Date(t.data_transacao), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800 dark:text-slate-100">{t.descricao}</TableCell>
                    <TableCell className="font-semibold text-slate-400 dark:text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5" />
                        {t.conta?.nome || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        t.tipo === 'Receita' || (t.tipo === 'Transferencia' && t.descricao.includes('[Entrada]')) 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : t.tipo === 'Despesa' || (t.tipo === 'Transferencia' && t.descricao.includes('[Saída]')) 
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-850 dark:text-slate-300'
                      }`}>
                        {t.tipo === 'Transferencia' 
                          ? (t.descricao.includes('[Saída]') ? 'Transf. Saída' : 'Transf. Entrada')
                          : t.tipo
                        }
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => t.id && toggleMutation.mutate(t.id)}
                        disabled={toggleMutation.isPending}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold cursor-pointer border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                          t.status === 'Pago' 
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 dark:text-emerald-400' 
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 dark:text-amber-400'
                        }`}
                      >
                        {t.status === 'Pago' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                        {t.status}
                      </button>
                    </TableCell>
                    <TableCell className={`text-right font-bold text-sm ${
                      t.tipo === 'Despesa' || (t.tipo === 'Transferencia' && t.descricao.includes('[Saída]'))
                        ? 'text-rose-600 dark:text-rose-400' 
                        : t.tipo === 'Receita' || (t.tipo === 'Transferencia' && t.descricao.includes('[Entrada]'))
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : 'text-slate-800 dark:text-slate-100'
                    }`}>
                      {t.tipo === 'Despesa' || (t.tipo === 'Transferencia' && t.descricao.includes('[Saída]')) ? '-' : '+'}
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.valor)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <NovaTransacaoModal editItem={t} />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => t.id && handleDelete(t.id, t.descricao)}
                          className="h-8 w-8 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-32 text-slate-400 font-semibold">
                    Nenhuma transação atende aos filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Barra de Ações em Lote (SaaS Premium Style) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-955/95 backdrop-blur-md border border-slate-800 dark:border-slate-850 text-slate-100 px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center bg-emerald-600 text-white font-bold text-xs px-2.5 py-1 rounded-full">
              {selectedIds.length}
            </span>
            <span className="text-sm font-semibold">
              {selectedIds.length === 1 ? 'transação selecionada' : 'transações selecionadas'}
            </span>
          </div>
          
          <div className="h-4 w-px bg-slate-800" />
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-xl"
            >
              Desmarcar
            </Button>
            <Button
              size="sm"
              disabled={deleteBatchMutation.isPending}
              onClick={handleDeleteBatch}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold gap-2 px-4 py-2 rounded-xl transition-all shadow-md hover:shadow-rose-600/10 active:scale-[0.98]"
            >
              {deleteBatchMutation.isPending ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Excluir Selecionadas
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
