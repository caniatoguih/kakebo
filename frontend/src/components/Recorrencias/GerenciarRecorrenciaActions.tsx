import { type ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, OctagonX } from 'lucide-react';
import { notify } from '@/components/FeedbackHost';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { recorrenciasService, type RecurrenceSummary } from '@/services/recorrenciasService';
import { transacoesService } from '@/services/transacoesService';

function competenceLabel(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function addMonths(value: string, months: number): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function GerenciarRecorrenciaActions({ recurrence, extendTrigger, endTrigger }: {
  recurrence: RecurrenceSummary;
  extendTrigger?: ReactNode;
  endTrigger?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [extendOpen, setExtendOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [months, setMonths] = useState(12);
  const [limit, setLimit] = useState('');
  const [error, setError] = useState('');
  const disabled = recurrence.situacao === 'Inconsistente';
  const invalidate = () => {
    ['recorrencias', 'contas', 'transacoes', 'faturas-cartao', 'fluxo-contabil'].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }));
    queryClient.invalidateQueries({ queryKey: ['recorrencia', recurrence.id] });
  };

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['recorrencia', recurrence.id],
    queryFn: () => recorrenciasService.obter(recurrence.id),
    enabled: endOpen,
  });
  const occurrences = useMemo(() => {
    const items = detail?.tipo === 'Transferencia'
      ? detail.ocorrencias.filter((item) => item.transferencia_direcao === 'Saida')
      : detail?.ocorrencias ?? [];
    return [...items].sort((a, b) => a.parcela_atual - b.parcela_atual);
  }, [detail]);
  const maxInstallment = occurrences.at(-1)?.parcela_atual ?? 0;
  const selected = occurrences.find((item) => String(item.parcela_atual) === limit);
  const removedCount = selected ? maxInstallment - selected.parcela_atual : 0;

  const extendMutation = useMutation({
    mutationFn: () => transacoesService.prorrogar(recurrence.id, months),
    onSuccess: (result) => { invalidate(); setExtendOpen(false); notify(result.message, 'success'); },
    onError: (requestError: any) => setError(requestError.response?.data?.message || 'Não foi possível prorrogar a recorrência.'),
  });
  const endMutation = useMutation({
    mutationFn: () => transacoesService.cancelarRecorrencia(recurrence.id, Number(limit)),
    onSuccess: (result) => { invalidate(); setEndOpen(false); notify(result.message, 'success'); },
    onError: (requestError: any) => setError(requestError.response?.data?.message || 'Não foi possível encerrar a recorrência.'),
  });

  const openExtend = (open: boolean) => {
    if (extendMutation.isPending) return;
    setExtendOpen(open); setMonths(12); setError('');
  };
  const openEnd = (open: boolean) => {
    if (endMutation.isPending) return;
    setEndOpen(open); setLimit(''); setError('');
  };

  return <>
    <Dialog open={extendOpen} onOpenChange={openExtend}>
      <DialogTrigger asChild>{extendTrigger ?? <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5"><CalendarPlus className="h-3.5 w-3.5" />Prorrogar</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Prorrogar — {recurrence.descricao}</DialogTitle><DialogDescription>Adicione novas competências ao final da recorrência. Os novos lançamentos serão criados como pendentes.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2"><Label htmlFor={`extend-months-${recurrence.id}`}>Quantidade de meses</Label><Input id={`extend-months-${recurrence.id}`} type="number" min={1} max={600} value={months} onChange={(event) => { setMonths(Number(event.target.value)); setError(''); }} /></div>
          {months > 0 && months <= 600 && <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p>Fim atual: <strong>{competenceLabel(recurrence.ultima_competencia)}</strong></p><p>Novo fim previsto: <strong>{competenceLabel(addMonths(recurrence.ultima_competencia, months))}</strong></p></div>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => openExtend(false)}>Cancelar</Button><Button disabled={extendMutation.isPending || months < 1 || months > 600} onClick={() => extendMutation.mutate()}>{extendMutation.isPending ? 'Prorrogando…' : `Adicionar ${months || 0} mês(es)`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={endOpen} onOpenChange={openEnd}>
      <DialogTrigger asChild>{endTrigger ?? <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5 text-rose-700 hover:text-rose-800"><OctagonX className="h-3.5 w-3.5" />Encerrar</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Encerrar — {recurrence.descricao}</DialogTitle><DialogDescription>Escolha a última competência que deve permanecer. As posteriores serão removidas definitivamente.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2"><Label htmlFor={`end-competence-${recurrence.id}`}>Última competência a manter</Label><Select value={limit} onValueChange={(value) => { setLimit(value); setError(''); }} disabled={loadingDetail}><SelectTrigger id={`end-competence-${recurrence.id}`}><SelectValue placeholder={loadingDetail ? 'Carregando…' : 'Selecione'} /></SelectTrigger><SelectContent>{occurrences.slice(0, -1).map((item) => <SelectItem key={item.id} value={String(item.parcela_atual)}>{competenceLabel(item.competencia)}</SelectItem>)}</SelectContent></Select></div>
          {!loadingDetail && maxInstallment <= 1 && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Esta recorrência não possui competências futuras para remover.</p>}
          {selected && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><strong>{removedCount} competência(s)</strong> após {competenceLabel(selected.competencia)} serão excluídas. Lançamentos pagos não podem ser removidos.</div>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => openEnd(false)}>Cancelar</Button><Button variant="destructive" disabled={endMutation.isPending || !selected || removedCount < 1} onClick={() => endMutation.mutate()}>{endMutation.isPending ? 'Encerrando…' : 'Confirmar encerramento'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
