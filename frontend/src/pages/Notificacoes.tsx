import { useState } from 'react';
import { Bell, BellRing, CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPaymentReminderPreferences, savePaymentReminderPreferences } from '@/lib/paymentReminderPreferences';
import { notificacoesService } from '@/services/notificacoesService';

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(value));

export function Notificacoes() {
  const { usuario } = useAuth();
  const initial = usuario ? getPaymentReminderPreferences(usuario.id) : { enabled: false, daysAhead: 3 };
  const [enabled, setEnabled] = useState(initial.enabled);
  const [daysAhead, setDaysAhead] = useState(initial.daysAhead);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => 'Notification' in window ? Notification.permission : 'unsupported');

  const remindersQuery = useQuery({
    queryKey: ['payment-reminders-preview', daysAhead],
    queryFn: () => notificacoesService.listarContasAPagar(daysAhead),
  });

  const save = (nextEnabled = enabled, nextDaysAhead = daysAhead) => {
    if (!usuario) return;
    savePaymentReminderPreferences(usuario.id, { enabled: nextEnabled, daysAhead: nextDaysAhead });
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    const nextEnabled = result === 'granted';
    setEnabled(nextEnabled);
    save(nextEnabled, daysAhead);
  };

  const changeDaysAhead = (value: number) => {
    const next = Math.max(0, Math.min(14, value || 0));
    setDaysAhead(next);
    save(enabled, next);
  };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold tracking-tight">Lembretes de pagamento</h1><p className="text-muted-foreground">Receba avisos para despesas pendentes e faturas próximas do vencimento.</p></div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-emerald-600" />Notificações do navegador</CardTitle><CardDescription>Os avisos são privados neste navegador e não são enviados por e-mail.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {permission === 'unsupported' ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Este navegador não oferece suporte a notificações.</p> : permission !== 'granted' ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted-foreground">Autorize as notificações para ativar os lembretes.</p><Button onClick={() => void requestPermission()}><Bell className="h-4 w-4" />Autorizar notificações</Button></div> : <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="h-4 w-4" />Notificações autorizadas neste navegador.</div>}
        <div className="flex flex-wrap items-end gap-5">
          <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={enabled} disabled={permission !== 'granted'} onChange={(event) => { setEnabled(event.target.checked); save(event.target.checked, daysAhead); }} />Ativar lembretes de pagamento</label>
          <div className="w-48 space-y-1.5"><Label htmlFor="reminder-days">Avisar com antecedência</Label><div className="flex items-center gap-2"><Input id="reminder-days" type="number" min="0" max="14" value={daysAhead} onChange={(event) => changeDaysAhead(Number(event.target.value))} /><span className="text-sm text-muted-foreground">dias</span></div></div>
        </div>
        <p className="text-xs text-muted-foreground">Enquanto o Kakebo estiver aberto, a verificação é feita ao entrar no app, ao voltar para a aba e a cada 30 minutos. Cada conta é avisada uma vez por vencimento.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-emerald-600" />Próximos pagamentos</CardTitle><CardDescription>Prévia dos itens que podem gerar lembretes.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void remindersQuery.refetch()} disabled={remindersQuery.isFetching}><RefreshCw className={remindersQuery.isFetching ? 'animate-spin' : ''} />Atualizar</Button></CardHeader>
      <CardContent>{remindersQuery.isLoading ? <p className="text-sm text-muted-foreground">Carregando pagamentos…</p> : remindersQuery.isError ? <p className="text-sm text-destructive">Não foi possível carregar os lembretes.</p> : remindersQuery.data?.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conta pendente vence neste período.</p> : <div className="space-y-2">{remindersQuery.data?.map((reminder) => <div key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><p className="font-medium">{reminder.descricao}</p><p className="text-xs text-muted-foreground">{reminder.conta_nome} · vence em {date(reminder.data_vencimento)}</p></div><strong>{brl(reminder.valor)}</strong></div>)}</div>}</CardContent>
    </Card>
  </div>;
}
