import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownCircle, ArrowRightLeft, ArrowUpCircle, CalendarClock, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, CircleAlert, Clock3, FilterX, RefreshCw, Search,
} from 'lucide-react';
import { contasService } from '@/services/contasService';
import {
  recorrenciasService, type RecurrenceFilters, type RecurrenceState,
  type RecurrenceSummary, type RecurrenceType,
} from '@/services/recorrenciasService';
import { QueryErrorState } from '@/components/QueryErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { AjustarValorRecorrenciaModal } from '@/components/Recorrencias/AjustarValorRecorrenciaModal';

const PAGE_SIZE = 20;
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const typeConfig: Record<RecurrenceType, { label: string; icon: typeof ArrowUpCircle; className: string }> = {
  Receita: { label: 'Receita', icon: ArrowUpCircle, className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  Despesa: { label: 'Despesa', icon: ArrowDownCircle, className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
  Transferencia: { label: 'Transferência', icon: ArrowRightLeft, className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
};

const stateConfig: Record<RecurrenceState, string> = {
  Ativa: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800',
  Encerrada: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
  Inconsistente: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800',
};

function formatCompetence(value: string | null): string {
  if (!value) return 'Sem próxima cobrança';
  const [year, month] = value.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function accountLabel(item: RecurrenceSummary): string {
  return item.conta_destino
    ? `${item.conta_origem.nome} → ${item.conta_destino.nome}`
    : item.conta_origem.nome;
}

function TypeBadge({ type }: { type: RecurrenceType }) {
  const config = typeConfig[type];
  const Icon = config.icon;
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold', config.className)}>
    <Icon className="h-3.5 w-3.5" aria-hidden="true" />{config.label}
  </span>;
}

function StateBadge({ state }: { state: RecurrenceState }) {
  return <span className={cn('inline-flex rounded-full px-2 py-1 text-xs font-bold ring-1 ring-inset', stateConfig[state])}>{state}</span>;
}

function DetailPanel({ id }: { id: string }) {
  const { data, isLoading, isError, isFetching, error, refetch } = useQuery({
    queryKey: ['recorrencia', id],
    queryFn: () => recorrenciasService.obter(id),
  });
  if (isLoading) return <div className="space-y-2 rounded-xl border bg-muted/20 p-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-16 w-full" /></div>;
  if (isError) return <QueryErrorState error={error} title="Erro ao carregar as competências." retrying={isFetching} onRetry={() => refetch()} />;
  if (!data) return null;
  const occurrences = data.tipo === 'Transferencia'
    ? data.ocorrencias.filter((item) => item.transferencia_direcao === 'Saida')
    : data.ocorrencias;
  const auditLabel = (action: string) => action === 'ALTERAR_VALOR_RECORRENCIA'
    ? 'Valor alterado'
    : action === 'CRIAR_TRANSFERENCIA_RECORRENTE' ? 'Transferência recorrente criada' : 'Recorrência criada';
  return <section aria-label={`Competências de ${data.descricao}`} className="space-y-5 rounded-xl border bg-muted/20 p-4">
    <div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-bold">Histórico e projeções</h3><p className="text-xs text-muted-foreground">{occurrences.length} competências geradas</p></div>
      <span className="text-sm font-semibold text-muted-foreground">Total previsto: {brl(data.total_previsto)}</span>
    </div>
    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {occurrences.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_1fr_auto]">
        <div><p className="font-semibold">{formatCompetence(item.competencia)}</p><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(item.data_transacao))}</p></div>
        <div className="hidden text-sm text-muted-foreground sm:block">{item.conta.nome}{item.fatura_id ? ' · Fatura vinculada' : ''}</div>
        <div className="text-right"><p className="font-bold">{brl(item.valor)}</p><p className={cn('text-xs font-semibold', item.status === 'Pago' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>{item.status}</p></div>
      </div>)}
    </div>
    </div>
    <div className="border-t pt-4">
      <div className="mb-3 flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><div><h3 className="font-bold">Histórico de alterações</h3><p className="text-xs text-muted-foreground">Operações registradas na auditoria financeira</p></div></div>
      {(data.historico ?? []).length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Ainda não há eventos de auditoria para esta série.</p> : <ol className="space-y-3">
        {data.historico.map((event) => {
          const previousValues = [...new Set(event.dados?.valores_anteriores?.map((item) => Number(item.valor)) ?? [])];
          return <li key={event.id} className="relative rounded-lg border bg-background p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{auditLabel(event.acao)}</p><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.data_criacao))}</p></div>{event.dados?.competencia_inicial && <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">A partir de {formatCompetence(event.dados.competencia_inicial)}</span>}</div>
            {event.acao === 'ALTERAR_VALOR_RECORRENCIA' && <p className="mt-2 text-muted-foreground">{previousValues.length > 0 ? `De ${previousValues.map(brl).join(', ')}` : 'Valor anterior não registrado'} <span aria-hidden="true">→</span> <strong className="text-foreground">{event.dados?.novo_valor === undefined ? 'novo valor não registrado' : brl(Number(event.dados.novo_valor))}</strong>{event.dados?.escopo ? ` · ${event.dados.escopo === 'SomenteCompetencia' ? 'somente uma competência' : 'competência e seguintes'}` : ''}</p>}
            {event.request_id && <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={event.request_id}>Referência: {event.request_id}</p>}
          </li>;
        })}
      </ol>}
    </div>
  </section>;
}

export function Recorrencias() {
  const [params, setParams] = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const search = params.get('busca') ?? '';
  const deferredSearch = useDeferredValue(search);
  const type = params.get('tipo') ?? 'Todos';
  const account = params.get('conta') ?? 'Todos';
  const state = params.get('situacao') ?? 'Todos';
  const page = Math.max(1, Number(params.get('pagina') ?? 1));

  const setFilter = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'Todos') next.delete(key); else next.set(key, value);
    if (key !== 'pagina') next.delete('pagina');
    setExpandedId(null);
    setParams(next, { replace: true });
  };
  const clearFilters = () => { setExpandedId(null); setParams(new URLSearchParams(), { replace: true }); };
  const filters = useMemo<RecurrenceFilters>(() => ({
    page, limit: PAGE_SIZE,
    ...(deferredSearch && { busca: deferredSearch }),
    ...(type !== 'Todos' && { tipo: type as RecurrenceType }),
    ...(account !== 'Todos' && { conta_id: account }),
    ...(state !== 'Todos' && { situacao: state as RecurrenceState }),
  }), [page, deferredSearch, type, account, state]);

  const { data, isLoading, isError, isFetching, error, refetch } = useQuery({
    queryKey: ['recorrencias', filters], queryFn: () => recorrenciasService.listar(filters),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ['contas'], queryFn: contasService.listar });
  const hasFilters = Boolean(search || type !== 'Todos' || account !== 'Todos' || state !== 'Todos');
  const recurrences = data?.recorrencias ?? [];
  const totalPages = Math.max(1, data?.total_pages ?? 1);
  const toggleDetails = (id: string) => setExpandedId((current) => current === id ? null : id);

  return <div className="space-y-6">
    <header>
      <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><RefreshCw className="h-6 w-6" /></div><div><h1 className="text-3xl font-bold tracking-tight">Lançamentos recorrentes</h1><p className="text-muted-foreground">Acompanhe cobranças, receitas e transferências que se repetem.</p></div></div>
    </header>

    <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_200px_170px_auto] lg:items-end">
      <div className="space-y-2 sm:col-span-2 lg:col-span-1"><Label htmlFor="recurrence-search">Buscar recorrência</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="recurrence-search" value={search} onChange={(event) => setFilter('busca', event.target.value)} placeholder="Ex.: aluguel, academia..." className="pl-9" /></div></div>
      <div className="space-y-2"><Label htmlFor="recurrence-type">Tipo</Label><Select value={type} onValueChange={(value) => setFilter('tipo', value)}><SelectTrigger id="recurrence-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todos">Todos</SelectItem><SelectItem value="Receita">Receitas</SelectItem><SelectItem value="Despesa">Despesas</SelectItem><SelectItem value="Transferencia">Transferências</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="recurrence-account">Conta</Label><Select value={account} onValueChange={(value) => setFilter('conta', value)}><SelectTrigger id="recurrence-account"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todos">Todas as contas</SelectItem>{accounts.map((item) => item.id && <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="recurrence-state">Situação</Label><Select value={state} onValueChange={(value) => setFilter('situacao', value)}><SelectTrigger id="recurrence-state"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Todos">Todas</SelectItem><SelectItem value="Ativa">Ativas</SelectItem><SelectItem value="Encerrada">Encerradas</SelectItem><SelectItem value="Inconsistente">Inconsistentes</SelectItem></SelectContent></Select></div>
      <Button variant="outline" onClick={clearFilters} disabled={!hasFilters} className="gap-2"><FilterX className="h-4 w-4" />Limpar</Button>
    </CardContent></Card>

    {!isLoading && !isError && <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground"><strong className="text-foreground">{data?.total ?? 0}</strong> recorrências encontradas</p>{isFetching && <span className="text-xs text-muted-foreground">Atualizando…</span>}</div>}
    {isLoading && <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full rounded-xl" />)}</div>}
    {isError && <QueryErrorState error={error} title="Erro ao carregar lançamentos recorrentes." retrying={isFetching} onRetry={() => refetch()} />}
    {!isLoading && !isError && recurrences.length === 0 && <EmptyState icon={CalendarClock} title={hasFilters ? 'Nenhuma recorrência encontrada' : 'Nenhum lançamento recorrente'} description={hasFilters ? 'Revise ou limpe os filtros para ampliar a busca.' : 'Ao registrar uma receita, despesa ou transferência recorrente, ela aparecerá aqui.'} action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button> : undefined} />}

    {!isLoading && !isError && recurrences.length > 0 && <>
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table><TableHeader><TableRow><TableHead>Recorrência</TableHead><TableHead>Tipo</TableHead><TableHead>Conta</TableHead><TableHead>Valor atual</TableHead><TableHead>Próxima</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
          {recurrences.map((item) => <TableRow key={item.id}><TableCell><p className="font-semibold">{item.descricao}</p><p className="text-xs text-muted-foreground">{item.ocorrencias_geradas} competências · até {formatCompetence(item.ultima_competencia)}</p></TableCell><TableCell><TypeBadge type={item.tipo} /></TableCell><TableCell className="max-w-52 truncate" title={accountLabel(item)}>{accountLabel(item)}</TableCell><TableCell className="font-bold">{brl(item.valor_atual)}</TableCell><TableCell>{formatCompetence(item.proxima_competencia)}</TableCell><TableCell><StateBadge state={item.situacao} /></TableCell><TableCell><div className="flex justify-end gap-1"><AjustarValorRecorrenciaModal recurrence={item} /><Button variant="ghost" size="sm" aria-expanded={expandedId === item.id} onClick={() => toggleDetails(item.id)} className="gap-1">Ver {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></div></TableCell></TableRow>)}
        </TableBody></Table>
      </div>
      <div className="hidden md:block">{expandedId && <DetailPanel id={expandedId} />}</div>

      <div className="space-y-3 md:hidden">{recurrences.map((item) => <Card key={item.id} className={cn(item.situacao === 'Inconsistente' && 'border-amber-300 dark:border-amber-800')}><CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-bold">{item.descricao}</p><p className="truncate text-sm text-muted-foreground">{accountLabel(item)}</p></div><p className="shrink-0 text-lg font-extrabold">{brl(item.valor_atual)}</p></div>
        <div className="flex flex-wrap items-center gap-2"><TypeBadge type={item.tipo} /><StateBadge state={item.situacao} />{item.situacao === 'Inconsistente' && <CircleAlert className="h-4 w-4 text-amber-600" aria-label="Série inconsistente" />}</div>
        <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Próxima competência</p><p className="font-semibold">{formatCompetence(item.proxima_competencia)}</p></div><div><p className="text-xs text-muted-foreground">Projeções</p><p className="font-semibold">{item.ocorrencias_geradas} até {formatCompetence(item.ultima_competencia)}</p></div></div>
        <div className="grid grid-cols-2 gap-2"><AjustarValorRecorrenciaModal recurrence={item} /><Button variant="outline" className="justify-between" aria-expanded={expandedId === item.id} onClick={() => toggleDetails(item.id)}>Ver histórico {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></div>
        {expandedId === item.id && <DetailPanel id={item.id} />}
      </CardContent></Card>)}</div>

      <nav aria-label="Paginação de recorrências" className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setFilter('pagina', String(page - 1))}><ChevronLeft className="h-4 w-4" />Anterior</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setFilter('pagina', String(page + 1))}>Próxima<ChevronRight className="h-4 w-4" /></Button></div></nav>
    </>}
  </div>;
}
