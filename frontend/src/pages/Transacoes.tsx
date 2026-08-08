import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, FileDown, Filter, Search, Trash2, X } from 'lucide-react';
import { notify } from '@/components/FeedbackHost';
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog';
import { QueryErrorState } from '@/components/QueryErrorState';
import { EmptyState } from '@/components/EmptyState';
import { TransactionListSkeleton } from '@/components/TransactionListSkeleton';
import { transacoesService, type TransacaoData, type TransactionFilters, type TransactionListResponse } from '@/services/transacoesService';
import { contasService } from '@/services/contasService';
import { categoriasService } from '@/services/categoriasService';
import { NovaTransacaoModal } from '@/components/Transacoes/NovaTransacaoModal';
import { ImportarCSVModal } from '@/components/Transacoes/ImportarCSVModal';
import { SincronizarOFXModal } from '@/components/Transacoes/SincronizarOFXModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 25;
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function transferDestination(item: TransacaoData) {
  return item.transferencia_grupo?.transacoes.find((side) => side.transferencia_direcao === 'Entrada');
}

function cleanDescription(item: TransacaoData) {
  return item.descricao.replace(/^\[(?:Saída|Entrada)\]\s*/, '');
}

export function Transacoes() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(params.size > 0);
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<TransacaoData | null>(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const search = params.get('busca') ?? '';
  const deferredSearch = useDeferredValue(search);
  const status = params.get('status') ?? 'Todos';
  const account = params.get('conta') ?? 'Todos';
  const subcategory = params.get('subcategoria') ?? 'Todos';
  const period = params.get('periodo') ?? 'Mes';
  const month = params.get('mes') ?? new Date().toISOString().slice(0, 7);
  const startDate = params.get('inicio') ?? '';
  const endDate = params.get('fim') ?? '';
  const page = Math.max(1, Number(params.get('pagina') ?? 1));

  const setFilter = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (key === 'periodo' && value === 'Todos') next.set(key, value);
    else if (!value || value === 'Todos') next.delete(key);
    else next.set(key, value);
    if (key !== 'pagina') next.delete('pagina');
    setParams(next, { replace: true });
  };
  const clearFilters = () => setParams(new URLSearchParams({ periodo: 'Todos' }), { replace: true });

  const filters = useMemo<TransactionFilters>(() => {
    const [year, selectedMonth] = month.split('-').map(Number);
    return {
      page, limit: PAGE_SIZE,
      ...(deferredSearch && { busca: deferredSearch }),
      ...(status !== 'Todos' && { status: status as 'Pago' | 'Pendente' }),
      ...(account !== 'Todos' && { conta_id: account }),
      ...(subcategory !== 'Todos' && { subcategoria_id: subcategory }),
      ...(period === 'Mes' && { mes: selectedMonth, ano: year }),
      ...(period === 'Personalizado' && startDate && { inicio: startDate }),
      ...(period === 'Personalizado' && endDate && { fim: endDate }),
    };
  }, [deferredSearch, status, account, subcategory, period, month, startDate, endDate, page]);

  const { data, isLoading, isError, isFetching, error: queryError, refetch } = useQuery({
    queryKey: ['transacoes', filters], queryFn: () => transacoesService.listar(filters),
  });
  const { data: contas = [] } = useQuery({ queryKey: ['contas'], queryFn: contasService.listar });
  const { data: categorias = [] } = useQuery({ queryKey: ['categorias'], queryFn: categoriasService.listar });
  const transactions = useMemo(() => data?.transacoes ?? [], [data?.transacoes]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transacoes'] });
    queryClient.invalidateQueries({ queryKey: ['contas'] });
    queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
  };
  const toggleMutation = useMutation({
    mutationFn: transacoesService.toggleStatus,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['transacoes'] });
      const snapshots = queryClient.getQueriesData<TransactionListResponse>({ queryKey: ['transacoes'] });
      queryClient.setQueriesData<TransactionListResponse>({ queryKey: ['transacoes'] }, (current) => current ? {
        ...current,
        transacoes: current.transacoes.map((item) => item.id === id ? { ...item, status: item.status === 'Pago' ? 'Pendente' : 'Pago' } : item),
      } : current);
      return { snapshots };
    },
    onSuccess: (updated, id) => notify(`Status alterado para ${updated.status}.`, 'success', {
      label: 'Desfazer',
      onClick: async () => {
        try {
          await transacoesService.toggleStatus(id);
          invalidate();
          notify('Alteração de status desfeita.', 'info');
        } catch (error: any) {
          notify(error.response?.data?.message || 'Não foi possível desfazer a alteração.');
        }
      },
    }),
    onError: (error: any, _id, context) => {
      context?.snapshots.forEach(([key, value]) => queryClient.setQueryData(key, value));
      notify(error.response?.data?.message || 'Erro ao alterar status.');
    },
    onSettled: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: transacoesService.excluir, onSuccess: () => { invalidate(); setPendingDelete(null); notify('Lançamento excluído com sucesso.', 'success'); }, onError: (e: any) => notify(e.response?.data?.message || 'Erro ao excluir lançamento.') });
  const deleteBatch = useMutation({ mutationFn: transacoesService.excluirEmLote, onSuccess: () => { invalidate(); setSelectedIds([]); setConfirmBatchDelete(false); notify('Lançamentos excluídos com sucesso.', 'success'); }, onError: (e: any) => notify(e.response?.data?.message || 'Erro ao excluir lançamentos.') });

  const remove = (item: TransacaoData) => item.id && setPendingDelete(item);
  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const activeFilters = [
    deferredSearch && { key: 'busca', label: `Busca: ${deferredSearch}` },
    status !== 'Todos' && { key: 'status', label: status },
    account !== 'Todos' && { key: 'conta', label: contas.find((item) => item.id === account)?.nome ?? 'Conta' },
    subcategory !== 'Todos' && { key: 'subcategoria', label: `Categoria: ${categorias.flatMap((item) => item.subcategorias).find((item) => item.id === subcategory)?.nome ?? 'selecionada'}` },
    period === 'Mes' && { key: 'periodo', label: `Mês: ${month}` },
    period === 'Personalizado' && { key: 'periodo', label: `Período: ${startDate || 'início'} até ${endDate || 'hoje'}` },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const grouped = useMemo(() => transactions.reduce<Record<string, TransacaoData[]>>((result, item) => {
    const key = format(new Date(item.data_transacao), "dd 'de' MMMM", { locale: ptBR });
    (result[key] ??= []).push(item); return result;
  }, {}), [transactions]);

  const accountLabel = (item: TransacaoData) => item.tipo === 'Transferencia'
    ? `${item.conta?.nome ?? 'Origem'} → ${transferDestination(item)?.conta.nome ?? 'Destino'}`
    : item.conta?.nome ?? 'N/A';

  const typeStyle = (item: TransacaoData) => item.tipo === 'Receita'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : item.tipo === 'Despesa'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';

  const transactionActions = (item: TransacaoData) => <div className="flex items-center gap-1">
    <NovaTransacaoModal editItem={item} />
    <Button aria-label={`Excluir ${cleanDescription(item)}`} variant="ghost" size="icon" onClick={() => remove(item)} className="h-9 w-9 text-rose-600"><Trash2 /></Button>
  </div>;

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1><p className="text-muted-foreground">Monitore receitas, despesas e transferências.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <NovaTransacaoModal />
        <div className="relative">
          <Button variant="outline" onClick={() => setShowImport((value) => !value)} className="gap-2"><FileDown /> Importar</Button>
          {showImport && <div className="absolute right-0 top-11 z-30 w-52 space-y-1 rounded-xl border bg-background p-2 shadow-xl">
            <SincronizarOFXModal trigger={<Button variant="ghost" className="w-full justify-start">Sincronizar OFX</Button>} />
            <ImportarCSVModal trigger={<Button variant="ghost" className="w-full justify-start">Importar CSV</Button>} />
          </div>}
        </div>
      </div>
    </header>

    <Card><CardContent className="p-4">
      <button className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setShowFilters((value) => !value)}><span className="flex items-center gap-2"><Filter /> Filtros</span><span>{showFilters ? 'Ocultar' : 'Mostrar'}</span></button>
      {showFilters && <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div><Label htmlFor="transaction-search">Descrição</Label><div className="relative mt-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="transaction-search" className="pl-9" value={search} onChange={(event) => setFilter('busca', event.target.value)} placeholder="Buscar..." /></div></div>
        <div><Label>Status</Label><Select value={status} onValueChange={(value) => setFilter('status', value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todos">Todos</SelectItem><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem></SelectContent></Select></div>
        <div><Label>Conta</Label><Select value={account} onValueChange={(value) => setFilter('conta', value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todos">Todas</SelectItem>{contas.map((item) => <SelectItem key={item.id} value={item.id!}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Subcategoria</Label><Select value={subcategory} onValueChange={(value) => setFilter('subcategoria', value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todos">Todas</SelectItem>{categorias.flatMap((category) => category.subcategorias.map((item) => <SelectItem key={item.id} value={item.id}>{category.nome} · {item.nome}</SelectItem>))}</SelectContent></Select></div>
        <div><Label>Período</Label><Select value={period} onValueChange={(value) => setFilter('periodo', value)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Mes">Mês específico</SelectItem><SelectItem value="Personalizado">Período personalizado</SelectItem><SelectItem value="Todos">Todo o histórico</SelectItem></SelectContent></Select></div>
        {period === 'Mes' && <div><Label htmlFor="transaction-month">Mês</Label><Input id="transaction-month" type="month" className="mt-1" value={month} onChange={(event) => setFilter('mes', event.target.value)} /></div>}
        {period === 'Personalizado' && <><div><Label htmlFor="transaction-start">Data inicial</Label><Input id="transaction-start" type="date" className="mt-1" value={startDate} max={endDate || undefined} onChange={(event) => setFilter('inicio', event.target.value)} /></div><div><Label htmlFor="transaction-end">Data final</Label><Input id="transaction-end" type="date" className="mt-1" value={endDate} min={startDate || undefined} onChange={(event) => setFilter('fim', event.target.value)} /></div></>}
      </div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">{activeFilters.map((filter) => <button key={filter.key} onClick={() => filter.key === 'periodo' ? setFilter('periodo', 'Todos') : setFilter(filter.key)} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium">{filter.label}<X className="h-3 w-3" /></button>)}<Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button></div>
    </CardContent></Card>

    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{total} {total === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'}</span><span>Página {page} de {totalPages}</span></div>

    {isLoading ? <TransactionListSkeleton />
      : isError ? <QueryErrorState error={queryError} title="Não foi possível carregar os lançamentos." retrying={isFetching} onRetry={() => refetch()} />
      : transactions.length === 0 ? <EmptyState icon={CreditCard} title={period === 'Todos' && activeFilters.length === 0 ? 'Registre seu primeiro lançamento' : 'Nenhum lançamento encontrado'} description={period === 'Todos' && activeFilters.length === 0 ? 'Registre uma receita, despesa ou transferência para começar a acompanhar seu fluxo de caixa.' : 'Não há lançamentos que correspondam aos filtros atuais. Limpe os filtros ou registre uma nova movimentação.'} action={<>{activeFilters.length > 0 && <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>}<NovaTransacaoModal /></>} />
      : <>
        <div className="space-y-5 md:hidden">{Object.entries(grouped).map(([date, items]) => <section key={date}><h2 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">{date}</h2><div className="space-y-2">{items.map((item) => <Card key={item.id}><CardContent className="flex gap-3 p-4"><input aria-label={`Selecionar ${cleanDescription(item)}`} type="checkbox" checked={!!item.id && selectedIds.includes(item.id)} onChange={() => item.id && toggleSelected(item.id)} /><div className="min-w-0 flex-1"><span className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${typeStyle(item)}`}>{item.tipo === 'Transferencia' ? 'Transferência' : item.tipo}</span><p className="truncate font-semibold">{cleanDescription(item)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{accountLabel(item)}</p><button title="Clique para alterar o status" aria-label={`Alterar status de ${cleanDescription(item)}`} onClick={() => item.id && toggleMutation.mutate(item.id)} className="mt-2 cursor-pointer rounded-full border px-2 py-1 text-xs font-medium transition-colors hover:border-primary hover:bg-muted hover:text-primary">{item.status}</button></div><div className="text-right"><p className={`font-bold ${item.tipo === 'Despesa' ? 'text-rose-600' : item.tipo === 'Receita' ? 'text-emerald-600' : 'text-blue-600'}`}>{item.tipo === 'Despesa' ? '-' : item.tipo === 'Receita' ? '+' : ''}{brl(Number(item.valor))}</p>{transactionActions(item)}</div></CardContent></Card>)}</div></section>)}</div>
        <Card className="hidden overflow-hidden md:block"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead /><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Conta</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{transactions.map((item) => <TableRow key={item.id}><TableCell><input aria-label={`Selecionar ${cleanDescription(item)}`} type="checkbox" checked={!!item.id && selectedIds.includes(item.id)} onChange={() => item.id && toggleSelected(item.id)} /></TableCell><TableCell>{format(new Date(item.data_transacao), 'dd/MM/yyyy')}</TableCell><TableCell className="font-semibold">{cleanDescription(item)}</TableCell><TableCell><span className="flex items-center gap-1"><CreditCard className="h-4 w-4" />{accountLabel(item)}</span></TableCell><TableCell><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${typeStyle(item)}`}>{item.tipo === 'Transferencia' ? 'Transferência' : item.tipo}</span></TableCell><TableCell><button title="Clique para alterar o status" aria-label={`Alterar status de ${cleanDescription(item)}`} className="cursor-pointer rounded-full border px-2 py-1 text-xs font-medium transition-all hover:border-primary hover:bg-muted hover:text-primary hover:shadow-sm" onClick={() => item.id && toggleMutation.mutate(item.id)}>{item.status === 'Pago' ? <CheckCircle2 className="inline h-4 w-4 text-emerald-600" /> : <Clock className="inline h-4 w-4 text-amber-600" />} {item.status}</button></TableCell><TableCell className="text-right font-bold">{item.tipo === 'Despesa' ? '-' : item.tipo === 'Receita' ? '+' : ''}{brl(Number(item.valor))}</TableCell><TableCell>{transactionActions(item)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      </>}

    <div className="flex justify-center gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setFilter('pagina', String(page - 1))}><ChevronLeft /> Anterior</Button><Button variant="outline" disabled={page >= totalPages} onClick={() => setFilter('pagina', String(page + 1))}>Próxima <ChevronRight /></Button></div>

    {selectedIds.length > 0 && <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-2xl md:left-1/2 md:right-auto md:-translate-x-1/2"><span className="text-sm font-semibold">{selectedIds.length} selecionado(s)</span><div className="flex gap-2"><Button variant="ghost" onClick={() => setSelectedIds([])}>Desmarcar</Button><Button variant="destructive" disabled={deleteBatch.isPending} onClick={() => setConfirmBatchDelete(true)}><Trash2 /> Excluir</Button></div></div>}
    <ConfirmActionDialog
      open={!!pendingDelete}
      onOpenChange={(open) => !open && setPendingDelete(null)}
      title="Excluir lançamento?"
      description={`O lançamento “${pendingDelete ? cleanDescription(pendingDelete) : ''}” será removido permanentemente.`}
      impact={pendingDelete?.tipo === 'Transferencia' ? 'As movimentações de origem e destino serão removidas e os saldos das duas contas serão recalculados.' : 'O impacto deste lançamento será revertido no saldo da conta e, quando aplicável, na fatura do cartão.'}
      pending={deleteMutation.isPending}
      onConfirm={() => pendingDelete?.id && deleteMutation.mutate(pendingDelete.id)}
    />
    <ConfirmActionDialog
      open={confirmBatchDelete}
      onOpenChange={setConfirmBatchDelete}
      title={`Excluir ${selectedIds.length} lançamento(s)?`}
      description="Os lançamentos selecionados serão removidos permanentemente."
      impact="Os impactos nos saldos, faturas e transferências relacionadas serão revertidos."
      pending={deleteBatch.isPending}
      onConfirm={() => deleteBatch.mutate(selectedIds)}
    />
  </div>;
}
