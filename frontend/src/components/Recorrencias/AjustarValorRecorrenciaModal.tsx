import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Pencil, ShieldAlert } from 'lucide-react';
import { notify } from '@/components/FeedbackHost';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  recorrenciasService, type RecurrenceChangeInput, type RecurrenceChangeScope,
  type RecurrenceChangeSimulation, type RecurrenceSummary,
} from '@/services/recorrenciasService';
import { cn } from '@/lib/utils';

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function competenceLabel(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function AjustarValorRecorrenciaModal({ recurrence }: { recurrence: RecurrenceSummary }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState(recurrence.valor_atual);
  const [competence, setCompetence] = useState(recurrence.proxima_competencia ?? recurrence.ultima_competencia);
  const [scope, setScope] = useState<RecurrenceChangeScope>('DestaCompetenciaEmDiante');
  const [simulation, setSimulation] = useState<RecurrenceChangeSimulation | null>(null);
  const [confirmClosedInvoices, setConfirmClosedInvoices] = useState(false);
  const [formError, setFormError] = useState('');

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['recorrencia', recurrence.id],
    queryFn: () => recorrenciasService.obter(recurrence.id),
    enabled: open,
  });
  const competencies = useMemo(() => [...new Set(detail?.ocorrencias.map((item) => item.competencia) ?? [])].sort(), [detail]);
  const input: RecurrenceChangeInput = { novo_valor: newValue, competencia_inicial: competence, escopo: scope };

  const resetSimulation = () => {
    setSimulation(null);
    setConfirmClosedInvoices(false);
    setFormError('');
  };
  const handleOpenChange = (next: boolean) => {
    if (simulateMutation.isPending || executeMutation.isPending) return;
    setOpen(next);
    if (next) {
      setNewValue(recurrence.valor_atual);
      setCompetence(recurrence.proxima_competencia ?? recurrence.ultima_competencia);
      setScope('DestaCompetenciaEmDiante');
      resetSimulation();
    }
  };

  const simulateMutation = useMutation({
    mutationFn: () => recorrenciasService.simularAlteracao(recurrence.id, input),
    onSuccess: (result) => { setSimulation(result); setFormError(''); },
    onError: (error: any) => setFormError(error.response?.data?.message || 'Não foi possível simular a alteração.'),
  });
  const executeMutation = useMutation({
    mutationFn: () => recorrenciasService.alterarValor(recurrence.id, {
      ...input,
      simulacao_id: simulation!.simulacao_id,
      confirmar_faturas_fechadas: confirmClosedInvoices,
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recorrencias'] });
      queryClient.invalidateQueries({ queryKey: ['recorrencia', recurrence.id] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['faturas-cartao'] });
      queryClient.invalidateQueries({ queryKey: ['fluxo-contabil'] });
      setOpen(false);
      notify(`${result.ocorrencias_afetadas} competência(s) atualizada(s).`, 'success');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Não foi possível alterar a recorrência.';
      setFormError(message);
      if (error.response?.status === 409) setSimulation(null);
    },
  });

  const handleSimulate = () => {
    if (newValue <= 0) return setFormError('Informe um valor maior que zero.');
    if (!competence) return setFormError('Selecione a competência inicial.');
    simulateMutation.mutate();
  };
  const canExecute = Boolean(
    simulation?.pode_executar
    && (!simulation.requer_confirmacao_fatura_fechada || confirmClosedInvoices),
  );

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogTrigger asChild><Button variant="outline" size="sm" disabled={recurrence.situacao === 'Inconsistente'} title={recurrence.situacao === 'Inconsistente' ? 'Corrija a série inconsistente antes de alterar valores.' : 'Ajustar valor da recorrência'} className="gap-1.5"><Pencil className="h-3.5 w-3.5" />Ajustar valor</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Ajustar valor — {recurrence.descricao}</DialogTitle><DialogDescription>Escolha quando o novo valor começa. Nenhuma alteração será feita antes da revisão do impacto.</DialogDescription></DialogHeader>

      {!simulation ? <div className="space-y-5 py-2">
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3 text-sm"><div><p className="text-xs text-muted-foreground">Valor atual</p><p className="font-bold">{brl(recurrence.valor_atual)}</p></div><div><p className="text-xs text-muted-foreground">Próxima competência</p><p className="font-bold">{competenceLabel(recurrence.proxima_competencia ?? recurrence.ultima_competencia)}</p></div></div>
        <div className="space-y-2"><Label htmlFor={`recurrence-value-${recurrence.id}`}>Novo valor</Label><CurrencyInput id={`recurrence-value-${recurrence.id}`} value={newValue} onChange={(value) => { setNewValue(value); resetSimulation(); }} aria-invalid={newValue <= 0} /></div>
        <div className="space-y-2"><Label htmlFor={`recurrence-competence-${recurrence.id}`}>A partir da competência</Label><Select value={competence} onValueChange={(value) => { setCompetence(value); resetSimulation(); }} disabled={loadingDetail}><SelectTrigger id={`recurrence-competence-${recurrence.id}`}><SelectValue placeholder={loadingDetail ? 'Carregando…' : 'Selecione'} /></SelectTrigger><SelectContent>{competencies.map((item) => <SelectItem key={item} value={item}>{competenceLabel(item)}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor={`recurrence-scope-${recurrence.id}`}>Aplicar em</Label><Select value={scope} onValueChange={(value: RecurrenceChangeScope) => { setScope(value); resetSimulation(); }}><SelectTrigger id={`recurrence-scope-${recurrence.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SomenteCompetencia">Somente esta competência</SelectItem><SelectItem value="DestaCompetenciaEmDiante">Esta competência e todas as seguintes</SelectItem></SelectContent></Select></div>
      </div> : <div className="space-y-4 py-2">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" />Simulação concluída</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Valor atual</p><p className="font-bold">{simulation.valor_atual === null ? '—' : brl(simulation.valor_atual)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Novo valor</p><p className="font-bold">{brl(simulation.novo_valor)}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Competências</p><p className="font-bold">{simulation.ocorrencias_afetadas}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Diferença total</p><p className={cn('font-bold', simulation.diferenca_total > 0 ? 'text-rose-700 dark:text-rose-300' : simulation.diferenca_total < 0 ? 'text-emerald-700 dark:text-emerald-300' : '')}>{simulation.diferenca_total > 0 ? '+' : ''}{brl(simulation.diferenca_total)}</p></div>
        </div>
        <div className="rounded-lg border p-3 text-sm"><p><strong>Início:</strong> {competenceLabel(simulation.competencia_inicial)}</p><p><strong>Escopo:</strong> {simulation.escopo === 'SomenteCompetencia' ? 'somente esta competência' : 'esta competência e todas as seguintes'}</p><p><strong>Faturas recalculadas:</strong> {simulation.faturas_afetadas.length}</p></div>

        {simulation.competencias_bloqueadas.length > 0 && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><p className="mb-2 flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" />Alteração bloqueada</p><ul className="space-y-1">{simulation.competencias_bloqueadas.map((item, index) => <li key={`${item.competencia}-${index}`}>{competenceLabel(item.competencia)}: {item.motivo}</li>)}</ul></div>}
        {!simulation.pode_executar && simulation.competencias_bloqueadas.length === 0 && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Nenhuma ocorrência pode ser alterada com os critérios selecionados.</div>}
        {simulation.requer_confirmacao_fatura_fechada && <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><input type="checkbox" className="mt-1 h-4 w-4" checked={confirmClosedInvoices} onChange={(event) => setConfirmClosedInvoices(event.target.checked)} /><span><strong className="mb-1 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />Confirmar alteração em fatura fechada</strong>As competências {simulation.faturas_fechadas.map((item) => competenceLabel(item.competencia)).join(', ')} já estão fechadas ou vencidas e terão seus totais recalculados.</span></label>}
      </div>}

      {formError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{formError}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={simulateMutation.isPending || executeMutation.isPending} onClick={() => simulation ? resetSimulation() : handleOpenChange(false)}>{simulation ? 'Voltar' : 'Cancelar'}</Button>
        {!simulation ? <Button onClick={handleSimulate} disabled={simulateMutation.isPending || loadingDetail || competencies.length === 0}>{simulateMutation.isPending ? 'Simulando…' : <>Revisar impacto<ArrowRight className="ml-2 h-4 w-4" /></>}</Button> : <Button onClick={() => executeMutation.mutate()} disabled={!canExecute || executeMutation.isPending}>{executeMutation.isPending ? 'Salvando…' : 'Confirmar alteração'}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
