import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Calculator, CalendarPlus, Eye, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog';
import { notify } from '@/components/FeedbackHost';
import { contasService } from '@/services/contasService';
import { categoriasService } from '@/services/categoriasService';
import {
  planejamentoSalarialService,
  type PlanejamentoSalarial,
  type PlanejamentoSalarialPayload,
  type OpcoesLancamentoSalarial,
  type ResultadoCalculoSalarial,
} from '@/services/planejamentoSalarialService';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const FULL_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const numberValue = (value: string | number) => Number(value) || 0;
const dateOnly = (value: string) => value.slice(0, 10);
const apiErrorMessage = (error: any, fallback: string) => error?.response?.data?.errors?.[0]?.message
  || error?.response?.data?.message
  || fallback;

type VacationForm = { key: string; inicio: string; fim: string };
type SalaryForm = {
  empresa: string;
  ano: number;
  salario: string;
  contaId: string;
  subcategoriaId: string;
  pagamentoFolha: 'mesmo' | 'seguinte';
  estimarDezembroAnterior: boolean;
  incluir13: boolean;
  avos13: number;
  modo13: 'duas' | 'unica';
  mes13p1: number;
  mes13p2: number;
  vale: string;
  odonto: string;
  medica: string;
  outros: string;
  dependentes: number;
  melhorDeducao: boolean;
  bonusInss: boolean;
  bonusIrrf: boolean;
  bonus: string[];
  ferias: VacationForm[];
};

const emptyForm = (): SalaryForm => ({
  empresa: '', ano: new Date().getFullYear(), salario: '', contaId: '', subcategoriaId: '',
  pagamentoFolha: 'seguinte', estimarDezembroAnterior: true, incluir13: true, avos13: 12,
  modo13: 'duas', mes13p1: 11, mes13p2: 12, vale: '0', odonto: '0', medica: '0', outros: '0',
  dependentes: 0, melhorDeducao: true, bonusInss: false, bonusIrrf: true,
  bonus: Array.from({ length: 12 }, () => '0'), ferias: [],
});

function planToForm(plan: PlanejamentoSalarial): SalaryForm {
  const bonuses = Array.from({ length: 12 }, () => '0');
  plan.bonus.forEach((item) => { bonuses[item.mes - 1] = String(item.valor); });
  return {
    empresa: plan.empresa, ano: plan.ano, salario: String(plan.salario_base), contaId: plan.conta_id,
    subcategoriaId: plan.subcategoria_id, pagamentoFolha: plan.pagamento_folha,
    estimarDezembroAnterior: plan.estimar_dezembro_anterior, incluir13: plan.incluir_decimo_terceiro,
    avos13: plan.avos_decimo_terceiro, modo13: plan.modo_decimo_terceiro,
    mes13p1: plan.mes_primeira_parcela_13, mes13p2: plan.mes_segunda_parcela_13,
    vale: String(plan.vale_alimentacao), odonto: String(plan.odontologico), medica: String(plan.assistencia_medica),
    outros: String(plan.outros_descontos), dependentes: plan.dependentes, melhorDeducao: plan.melhor_deducao_irrf,
    bonusInss: plan.bonus.some((item) => item.incide_inss), bonusIrrf: plan.bonus.every((item) => item.incide_irrf !== false),
    bonus: bonuses,
    ferias: plan.ferias.map((item) => ({ key: item.id, inicio: dateOnly(item.inicio), fim: dateOnly(item.fim) })),
  };
}

function toPayload(form: SalaryForm): PlanejamentoSalarialPayload {
  const vale = numberValue(form.vale);
  const odonto = numberValue(form.odonto);
  const medica = numberValue(form.medica);
  const outros = numberValue(form.outros);
  return {
    empresa: form.empresa.trim(), ano: form.ano, salario_base: numberValue(form.salario), conta_id: form.contaId,
    subcategoria_id: form.subcategoriaId, pagamento_folha: form.pagamentoFolha,
    estimar_dezembro_anterior: form.estimarDezembroAnterior, incluir_decimo_terceiro: form.incluir13,
    avos_decimo_terceiro: form.avos13, modo_decimo_terceiro: form.modo13,
    mes_primeira_parcela_13: form.mes13p1, mes_segunda_parcela_13: form.mes13p2,
    descontos_mensais: vale + odonto + medica + outros, vale_alimentacao: vale, odontologico: odonto,
    assistencia_medica: medica, outros_descontos: outros, dependentes: form.dependentes,
    melhor_deducao_irrf: form.melhorDeducao,
    ferias: form.ferias.filter((item) => item.inicio && item.fim).map(({ inicio, fim }) => ({ inicio, fim })),
    bonus: form.bonus.map((value, index) => ({ mes: index + 1, valor: numberValue(value), incide_inss: form.bonusInss, incide_irrf: form.bonusIrrf })).filter((item) => item.valor > 0),
  };
}

function competenceLabel(value: string | null): string {
  if (!value) return '—';
  const match = value.match(/^(\d{4})-(\d{2})(.*)$/);
  if (!match) return value;
  return `Competência ${FULL_MONTHS[Number(match[2]) - 1]}/${match[1]}${match[3] ?? ''}`;
}

function SalaryCalculationResultView({ calculation, canLaunch, launchPending, onLaunch }: {
  calculation: ResultadoCalculoSalarial;
  canLaunch: boolean;
  launchPending: boolean;
  onLaunch: () => void;
}): ReactElement {
  const [view, setView] = useState<'recebimentos' | 'competencias'>('recebimentos');
  const cashSum = (key: 'folha' | 'reciboFerias' | 'decimoTerceiro' | 'total') => calculation.recebimentos.reduce((total, month) => total + month[key], 0);
  const competenceSum = (key: 'salarioProporcional' | 'feriasProvento' | 'tercoFerias' | 'bonus' | 'inss' | 'irrf' | 'descontos' | 'liquidoFolha' | 'reciboFerias' | 'decimoTerceiro' | 'recebido') => calculation.meses.reduce((total, month) => total + month[key], 0);

  return <section className="space-y-4" aria-label="Resultado do cálculo salarial">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Recebido no ano</p><p className="text-lg font-bold">{brl(calculation.totais.recebido)}</p></div>
      <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Média mensal recebida</p><p className="text-lg font-bold">{brl(calculation.totais.recebido / 12)}</p></div>
      <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Recibos de férias</p><p className="text-lg font-bold">{brl(calculation.totais.ferias)}</p></div>
      <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">13º líquido</p><p className="text-lg font-bold">{brl(calculation.totais.decimoTerceiro)}</p></div>
      <div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Bônus previstos</p><p className="text-lg font-bold">{brl(calculation.totais.bonus)}</p></div>
    </div>

    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Visão do planejamento salarial">
      <Button type="button" size="sm" variant={view === 'recebimentos' ? 'default' : 'outline'} role="tab" aria-selected={view === 'recebimentos'} onClick={() => setView('recebimentos')}>Fluxo de recebimento</Button>
      <Button type="button" size="sm" variant={view === 'competencias' ? 'default' : 'outline'} role="tab" aria-selected={view === 'competencias'} onClick={() => setView('competencias')}>Formação por competência</Button>
    </div>

    {view === 'recebimentos' && <div className="space-y-3" role="tabpanel">
      <div><h3 className="text-lg font-bold">Fluxo de recebimento</h3><p className="text-sm text-muted-foreground">Mostra quando o dinheiro entra na conta e a competência que originou cada folha.</p></div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3 text-left">Mês do recebimento</th><th className="p-3 text-left">Origem da folha</th><th className="p-3 text-right">Folha líquida</th><th className="p-3 text-right">Recibo de férias</th><th className="p-3 text-right">13º</th><th className="p-3 text-right">Total recebido</th></tr></thead>
          <tbody>{calculation.recebimentos.map((month) => <tr key={month.competencia} className="border-t"><td className="p-3 font-semibold">{FULL_MONTHS[month.mes - 1]}/{calculation.ano}</td><td className="p-3 text-muted-foreground">{competenceLabel(month.origemFolha)}</td><td className="p-3 text-right">{brl(month.folha)}</td><td className="p-3 text-right">{brl(month.reciboFerias)}</td><td className="p-3 text-right">{brl(month.decimoTerceiro)}</td><td className="p-3 text-right font-bold text-emerald-700">{brl(month.total)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t bg-muted/30 font-bold"><td className="p-3" colSpan={2}>Total recebido em {calculation.ano}</td><td className="p-3 text-right">{brl(cashSum('folha'))}</td><td className="p-3 text-right">{brl(cashSum('reciboFerias'))}</td><td className="p-3 text-right">{brl(cashSum('decimoTerceiro'))}</td><td className="p-3 text-right text-emerald-700">{brl(cashSum('total'))}</td></tr></tfoot>
        </table>
      </div>
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><strong>Como ler:</strong> recibos de férias e 13º aparecem no mês efetivo de pagamento. A folha é deslocada conforme a configuração “mesmo mês” ou “mês seguinte”.</p>
    </div>}

    {view === 'competencias' && <div className="space-y-3" role="tabpanel">
      <div><h3 className="text-lg font-bold">Formação da folha por competência</h3><p className="text-sm text-muted-foreground">Detalha os proventos e descontos calculados para cada mês trabalhado, independentemente do mês de recebimento.</p></div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[1250px] text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3 text-left">Competência</th><th className="p-3 text-right">Dias férias</th><th className="p-3 text-right">Salário prop.</th><th className="p-3 text-right">Férias + 1/3</th><th className="p-3 text-right">Bônus</th><th className="p-3 text-right">INSS</th><th className="p-3 text-right">IRRF</th><th className="p-3 text-right">Descontos</th><th className="p-3 text-right">Líquido folha</th><th className="p-3 text-right">Recibo férias</th><th className="p-3 text-right">13º</th><th className="p-3 text-right">Total associado</th></tr></thead>
          <tbody>{calculation.meses.map((month) => <tr key={month.competencia} className="border-t"><td className="p-3 font-semibold">{FULL_MONTHS[month.mes - 1]}/{calculation.ano}</td><td className="p-3 text-right">{month.diasFerias}</td><td className="p-3 text-right">{brl(month.salarioProporcional)}</td><td className="p-3 text-right">{brl(month.feriasProvento + month.tercoFerias)}</td><td className="p-3 text-right">{brl(month.bonus)}</td><td className="p-3 text-right text-rose-700">-{brl(month.inss)}</td><td className="p-3 text-right text-rose-700">-{brl(month.irrf)}</td><td className="p-3 text-right text-rose-700">-{brl(month.descontos)}</td><td className="p-3 text-right font-semibold">{brl(month.liquidoFolha)}</td><td className="p-3 text-right">{brl(month.reciboFerias)}</td><td className="p-3 text-right">{brl(month.decimoTerceiro)}</td><td className="p-3 text-right font-bold text-emerald-700">{brl(month.recebido)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t bg-muted/30 font-bold"><td className="p-3" colSpan={2}>Total por competência</td><td className="p-3 text-right">{brl(competenceSum('salarioProporcional'))}</td><td className="p-3 text-right">{brl(competenceSum('feriasProvento') + competenceSum('tercoFerias'))}</td><td className="p-3 text-right">{brl(competenceSum('bonus'))}</td><td className="p-3 text-right text-rose-700">-{brl(competenceSum('inss'))}</td><td className="p-3 text-right text-rose-700">-{brl(competenceSum('irrf'))}</td><td className="p-3 text-right text-rose-700">-{brl(competenceSum('descontos'))}</td><td className="p-3 text-right">{brl(competenceSum('liquidoFolha'))}</td><td className="p-3 text-right">{brl(competenceSum('reciboFerias'))}</td><td className="p-3 text-right">{brl(competenceSum('decimoTerceiro'))}</td><td className="p-3 text-right text-emerald-700">{brl(competenceSum('recebido'))}</td></tr></tfoot>
        </table>
      </div>
    </div>}

    {canLaunch && <Button type="button" className="gap-2" disabled={launchPending} onClick={onLaunch}><Upload className="h-4 w-4" />{launchPending ? 'Reconciliando…' : 'Lançar ou atualizar no Kakebo'}</Button>}
  </section>;
}

type SalaryLaunchTarget = { id: string; ano: number; empresa: string };

function SalaryLaunchDialog({ target, pending, onOpenChange, onConfirm }: {
  target: SalaryLaunchTarget | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: OpcoesLancamentoSalarial) => void;
}): ReactElement {
  const [initialMonth, setInitialMonth] = useState('');
  const [finalMonth, setFinalMonth] = useState('');
  const [launchDay, setLaunchDay] = useState(15);
  useEffect(() => {
    if (!target) return;
    const now = new Date();
    const firstMonth = target.ano === now.getFullYear() ? Math.min(12, now.getMonth() + 1) : 1;
    setInitialMonth(`${target.ano}-${String(firstMonth).padStart(2, '0')}`);
    setFinalMonth(`${target.ano}-12`);
    setLaunchDay(15);
  }, [target]);
  const valid = Boolean(initialMonth && finalMonth && initialMonth <= finalMonth && launchDay >= 1 && launchDay <= 31);

  return <Dialog open={Boolean(target)} onOpenChange={(open) => !pending && onOpenChange(open)}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Lançar planejamento parcialmente</DialogTitle><DialogDescription>Escolha os meses efetivos de recebimento que serão criados ou reconciliados para {target?.empresa ?? 'o planejamento'}.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2 sm:grid-cols-2">
        <div className="space-y-2"><Label>Mês inicial</Label><Select value={initialMonth} onValueChange={setInitialMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={`${target?.ano}-${String(index + 1).padStart(2, '0')}`}>{month}/{target?.ano}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Mês final</Label><Select value={finalMonth} onValueChange={setFinalMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={`${target?.ano}-${String(index + 1).padStart(2, '0')}`}>{month}/{target?.ano}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="salary-launch-day">Dia do lançamento em cada mês</Label><Input id="salary-launch-day" type="number" min="1" max="31" value={launchDay} onChange={(event) => setLaunchDay(numberValue(event.target.value))} /><p className="text-xs text-muted-foreground">Se o mês não possuir esse dia, será usado o último dia do mês.</p></div>
      </div>
      {initialMonth > finalMonth && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">O mês final deve ser igual ou posterior ao mês inicial.</p>}
      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><strong>Escopo:</strong> lançamentos anteriores e posteriores ao intervalo não serão alterados. Recebimentos já pagos dentro do intervalo também serão preservados.</div>
      <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" disabled={!valid || pending} onClick={() => onConfirm({ competencia_inicial: initialMonth, competencia_final: finalMonth, dia_lancamento: launchDay })}>{pending ? 'Reconciliando…' : 'Confirmar lançamento'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function PlanejamentoSalarialPanel(): ReactElement {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SalaryForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<ResultadoCalculoSalarial | null>(null);
  const [calculationPlanId, setCalculationPlanId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlanejamentoSalarial | null>(null);
  const [launchTarget, setLaunchTarget] = useState<SalaryLaunchTarget | null>(null);
  const { data: accounts = [] } = useQuery({ queryKey: ['contas'], queryFn: contasService.listar });
  const { data: categories = [] } = useQuery({ queryKey: ['categorias'], queryFn: categoriasService.listar });
  const plansQuery = useQuery({ queryKey: ['planejamento-salarial'], queryFn: planejamentoSalarialService.listar });
  const incomeCategories = categories.filter((category) => category.tipo === 'Receita');
  const salaryCategory = useMemo(() => incomeCategories.flatMap((category) => category.subcategorias).find((subcategory) => subcategory.nome.toLocaleLowerCase('pt-BR') === 'salário'), [incomeCategories]);

  useEffect(() => {
    if (!form.subcategoriaId && salaryCategory) setForm((current) => ({ ...current, subcategoriaId: salaryCategory.id }));
  }, [form.subcategoriaId, salaryCategory]);

  const save = useMutation({
    mutationFn: async () => editingId
      ? planejamentoSalarialService.atualizar(editingId, toPayload(form))
      : planejamentoSalarialService.criar(toPayload(form)),
    onSuccess: async (plan) => {
      await queryClient.invalidateQueries({ queryKey: ['planejamento-salarial'] });
      const result = await planejamentoSalarialService.calcular(plan.id);
      setCalculation(result); setCalculationPlanId(plan.id); setEditingId(plan.id); setForm(planToForm(plan));
      notify('Planejamento salarial salvo e calculado.', 'success');
    },
    onError: (error: any) => notify(apiErrorMessage(error, 'Não foi possível salvar o planejamento salarial.')),
  });
  const calculate = useMutation({
    mutationFn: planejamentoSalarialService.calcular,
    onSuccess: (result, id) => { setCalculation(result); setCalculationPlanId(id); },
    onError: () => notify('Não foi possível calcular o planejamento salarial.'),
  });
  const launch = useMutation({
    mutationFn: ({ id, options }: { id: string; options: OpcoesLancamentoSalarial }) => planejamentoSalarialService.lancar(id, options),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['planejamento-salarial'] });
      setLaunchTarget(null);
      const details = [result.removidos_pendentes ? `${result.removidos_pendentes} obsoleto(s) removido(s)` : '', result.ignorados_pago ? `${result.ignorados_pago} pago(s) preservado(s)` : ''].filter(Boolean).join(' · ');
      notify(`${result.message}${details ? ` ${details}.` : ''}`, 'success');
    },
    onError: () => notify('Não foi possível reconciliar os lançamentos salariais.'),
  });
  const remove = useMutation({
    mutationFn: planejamentoSalarialService.excluir,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['planejamento-salarial'] });
      setPendingDelete(null); setCalculation(null); setCalculationPlanId(null);
      if (pendingDelete?.id === editingId) { setEditingId(null); setForm(emptyForm()); }
      notify(`${result.message} ${result.lancamentos_pendentes_removidos} pendente(s) removido(s) e ${result.lancamentos_pagos_preservados} pago(s) preservado(s).`, 'success');
    },
    onError: () => notify('Não foi possível excluir o planejamento salarial.'),
  });

  const vacationError = useMemo(() => {
    if (form.ferias.some((item) => item.inicio && item.fim && item.fim < item.inicio)) return 'O fim das férias não pode ser anterior ao início.';
    const periods = form.ferias.filter((item) => item.inicio && item.fim).toSorted((a, b) => a.inicio.localeCompare(b.inicio));
    return periods.some((item, index) => index > 0 && item.inicio <= periods[index - 1].fim)
      ? 'Os períodos de férias não podem se sobrepor.'
      : null;
  }, [form.ferias]);
  const valid = form.empresa.trim().length >= 2 && numberValue(form.salario) > 0 && Boolean(form.contaId && form.subcategoriaId)
    && form.ferias.every((item) => Boolean(item.inicio && item.fim)) && !vacationError;
  const updateVacation = (key: string, field: 'inicio' | 'fim', value: string) => setForm((current) => ({ ...current, ferias: current.ferias.map((item) => item.key === key ? { ...item, [field]: value } : item) }));
  const updateBonus = (index: number, value: string) => setForm((current) => ({ ...current, bonus: current.bonus.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const startNew = () => { setEditingId(null); setForm({ ...emptyForm(), subcategoriaId: salaryCategory?.id ?? '' }); setCalculation(null); setCalculationPlanId(null); };
  const startEdit = (plan: PlanejamentoSalarial) => { setEditingId(plan.id); setForm(planToForm(plan)); setCalculation(null); setCalculationPlanId(null); };

  return <Card className="border-emerald-200/60 dark:border-emerald-900/40">
    <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-emerald-600" />Planejamento salarial</CardTitle><p className="mt-1 text-sm text-muted-foreground">Projete folha, férias, bônus e 13º e reconcilie as receitas pendentes.</p></div>
      <Button type="button" variant="outline" className="gap-2" onClick={startNew}><Plus className="h-4 w-4" />Novo planejamento</Button>
    </CardHeader>
    <CardContent className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-muted/10 p-4" aria-label="Configuração salarial">
        <div className="flex items-center justify-between"><h3 className="font-bold">{editingId ? 'Editar planejamento' : 'Novo planejamento'}</h3>{editingId && <Badge variant="secondary">Edição</Badge>}</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2"><Label htmlFor="salary-company">Empresa</Label><Input id="salary-company" value={form.empresa} onChange={(event) => setForm({ ...form, empresa: event.target.value })} placeholder="Nome da empresa" /></div>
          <div className="space-y-2"><Label htmlFor="salary-year">Ano</Label><Input id="salary-year" type="number" min="2026" max="2100" value={form.ano} onChange={(event) => setForm({ ...form, ano: numberValue(event.target.value) })} /></div>
          <div className="space-y-2"><Label htmlFor="salary-base">Salário-base</Label><Input id="salary-base" type="number" min="0" step="0.01" value={form.salario} onChange={(event) => setForm({ ...form, salario: event.target.value })} placeholder="0,00" /></div>
          <div className="space-y-2"><Label htmlFor="salary-dependents">Dependentes para IRRF</Label><Input id="salary-dependents" type="number" min="0" max="99" value={form.dependentes} onChange={(event) => setForm({ ...form, dependentes: numberValue(event.target.value) })} /></div>
          <div className="space-y-2"><Label>Conta de recebimento</Label><Select value={form.contaId} onValueChange={(value) => setForm({ ...form, contaId: value })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{accounts.filter((account) => account.tipo !== 'CartaoCredito').map((account) => <SelectItem key={account.id} value={account.id}>{account.nome}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Categoria de receita</Label><Select value={form.subcategoriaId} onValueChange={(value) => setForm({ ...form, subcategoriaId: value })}><SelectTrigger><SelectValue placeholder="Receitas › Salário" /></SelectTrigger><SelectContent>{incomeCategories.map((category) => <SelectGroup key={category.id}><SelectLabel>{category.nome}</SelectLabel>{category.subcategorias.map((subcategory) => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.nome}</SelectItem>)}</SelectGroup>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Recebimento da folha</Label><Select value={form.pagamentoFolha} onValueChange={(value: 'mesmo' | 'seguinte') => setForm({ ...form, pagamentoFolha: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mesmo">No mesmo mês</SelectItem><SelectItem value="seguinte">No mês seguinte</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 pt-7"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.melhorDeducao} onChange={(event) => setForm({ ...form, melhorDeducao: event.target.checked })} />Usar dedução de IR mais vantajosa</label></div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between"><div><h4 className="font-semibold">Férias previstas</h4><p className="text-xs text-muted-foreground">Períodos não podem se sobrepor.</p></div><Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setForm({ ...form, ferias: [...form.ferias, { key: crypto.randomUUID(), inicio: '', fim: '' }] })}><CalendarPlus className="h-4 w-4" />Adicionar férias</Button></div>
          {form.ferias.length === 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhum período de férias informado.</p>}
          {vacationError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{vacationError}</p>}
          {form.ferias.map((vacation, index) => <div key={vacation.key} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"><div className="space-y-2"><Label htmlFor={`vacation-start-${vacation.key}`}>Início do período {index + 1}</Label><Input id={`vacation-start-${vacation.key}`} type="date" value={vacation.inicio} onChange={(event) => updateVacation(vacation.key, 'inicio', event.target.value)} /></div><div className="space-y-2"><Label htmlFor={`vacation-end-${vacation.key}`}>Fim do período {index + 1}</Label><Input id={`vacation-end-${vacation.key}`} type="date" value={vacation.fim} onChange={(event) => updateVacation(vacation.key, 'fim', event.target.value)} /></div><Button type="button" variant="ghost" size="icon" className="text-rose-700" aria-label={`Remover período ${index + 1}`} onClick={() => setForm({ ...form, ferias: form.ferias.filter((item) => item.key !== vacation.key) })}><Trash2 className="h-4 w-4" /></Button></div>)}
        </div>

        <div className="grid gap-5 border-t pt-4 xl:grid-cols-2">
          <div className="space-y-3"><h4 className="font-semibold">Descontos mensais</h4><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="salary-food">Vale-alimentação</Label><Input id="salary-food" type="number" min="0" step="0.01" value={form.vale} onChange={(event) => setForm({ ...form, vale: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="salary-dental">Odontológico</Label><Input id="salary-dental" type="number" min="0" step="0.01" value={form.odonto} onChange={(event) => setForm({ ...form, odonto: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="salary-health">Assistência médica</Label><Input id="salary-health" type="number" min="0" step="0.01" value={form.medica} onChange={(event) => setForm({ ...form, medica: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="salary-other">Outros</Label><Input id="salary-other" type="number" min="0" step="0.01" value={form.outros} onChange={(event) => setForm({ ...form, outros: event.target.value })} /></div></div></div>
          <div className="space-y-3"><h4 className="font-semibold">13º salário</h4><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.incluir13} onChange={(event) => setForm({ ...form, incluir13: event.target.checked })} />Incluir 13º na projeção</label>{form.incluir13 && <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Forma de pagamento</Label><Select value={form.modo13} onValueChange={(value: 'duas' | 'unica') => setForm({ ...form, modo13: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="duas">Duas parcelas</SelectItem><SelectItem value="unica">Parcela única</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="salary-13-share">Avos</Label><Input id="salary-13-share" type="number" min="1" max="12" value={form.avos13} onChange={(event) => setForm({ ...form, avos13: numberValue(event.target.value) })} /></div>{form.modo13 === 'duas' && <><div className="space-y-2"><Label>Mês da 1ª parcela</Label><Select value={String(form.mes13p1)} onValueChange={(value) => setForm({ ...form, mes13p1: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Mês da 2ª parcela</Label><Select value={String(form.mes13p2)} onValueChange={(value) => setForm({ ...form, mes13p2: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent></Select></div></>}</div>}</div>
        </div>

        <div className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold">Bônus por mês</h4><p className="text-xs text-muted-foreground">Informe apenas os meses com previsão de bônus.</p></div><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.bonusInss} onChange={(event) => setForm({ ...form, bonusInss: event.target.checked })} />Incide INSS</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.bonusIrrf} onChange={(event) => setForm({ ...form, bonusIrrf: event.target.checked })} />Incide IRRF</label></div></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">{MONTHS.map((month, index) => <div key={month} className="space-y-1"><Label htmlFor={`salary-bonus-${index}`} className="text-xs">{month}</Label><Input id={`salary-bonus-${index}`} type="number" min="0" step="0.01" value={form.bonus[index]} onChange={(event) => updateBonus(index, event.target.value)} /></div>)}</div></div>

        {form.pagamentoFolha === 'seguinte' && <label className="flex items-center gap-2 border-t pt-4 text-sm"><input type="checkbox" checked={form.estimarDezembroAnterior} onChange={(event) => setForm({ ...form, estimarDezembroAnterior: event.target.checked })} />Estimar em janeiro a folha de dezembro do ano anterior</label>}
        <div className="flex flex-wrap gap-2 border-t pt-4"><Button type="button" className="gap-2" disabled={!valid || save.isPending} onClick={() => save.mutate()}>{editingId ? <Save className="h-4 w-4" /> : <Calculator className="h-4 w-4" />}{save.isPending ? 'Salvando…' : editingId ? 'Salvar e recalcular' : 'Calcular e salvar'}</Button>{editingId && <Button type="button" variant="outline" onClick={startNew}>Cancelar edição</Button>}</div>
      </section>

      {calculation && <SalaryCalculationResultView
        calculation={calculation}
        canLaunch={Boolean(calculationPlanId)}
        launchPending={launch.isPending}
        onLaunch={() => {
          if (!calculationPlanId) return;
          const plan = plansQuery.data?.find((item) => item.id === calculationPlanId);
          setLaunchTarget({ id: calculationPlanId, ano: calculation.ano, empresa: plan?.empresa ?? 'Planejamento salarial' });
        }}
      />}

      {(plansQuery.data?.length ?? 0) > 0 && <section className="space-y-2 border-t pt-5"><h3 className="font-bold">Planejamentos salariais salvos</h3>{plansQuery.data!.map((plan) => { const paid = plan.lancamentos?.filter((link) => link.transacao?.status === 'Pago').length ?? 0; return <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-semibold">{plan.empresa} · {plan.ano}</p><p className="text-sm text-muted-foreground">{brl(plan.salario_base)} · {plan.ferias.length} período(s) de férias · {plan.lancamentos?.length ?? 0} lançamento(s){paid ? ` · ${paid} pago(s)` : ''}</p></div><div className="flex flex-wrap gap-1"><Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => startEdit(plan)}><Pencil className="h-4 w-4" />Editar</Button><Button type="button" variant="ghost" size="sm" className="gap-1" disabled={calculate.isPending} onClick={() => calculate.mutate(plan.id)}><Eye className="h-4 w-4" />Ver cálculo</Button><Button type="button" variant="ghost" size="sm" className="gap-1" disabled={launch.isPending} onClick={() => setLaunchTarget({ id: plan.id, ano: plan.ano, empresa: plan.empresa })}><Upload className="h-4 w-4" />Lançar parcial</Button><Button type="button" variant="ghost" size="icon" className="text-rose-700" aria-label={`Excluir planejamento de ${plan.empresa}`} onClick={() => setPendingDelete(plan)}><Trash2 className="h-4 w-4" /></Button></div></div>; })}</section>}
    </CardContent>
    <SalaryLaunchDialog target={launchTarget} pending={launch.isPending} onOpenChange={(open) => !open && setLaunchTarget(null)} onConfirm={(options) => launchTarget && launch.mutate({ id: launchTarget.id, options })} />
    <ConfirmActionDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)} title="Excluir planejamento salarial?" description={`O planejamento de ${pendingDelete?.empresa ?? ''} será removido.`} impact="Lançamentos pendentes gerados pelo planejador serão excluídos. Recebimentos já pagos serão preservados." pending={remove.isPending} confirmLabel="Excluir planejamento" onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)} />
  </Card>;
}
