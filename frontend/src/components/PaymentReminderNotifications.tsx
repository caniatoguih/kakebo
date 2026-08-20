import { useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notificacoesService, type PaymentReminder } from '@/services/notificacoesService';
import { getPaymentReminderPreferences, onPaymentReminderPreferencesChange } from '@/lib/paymentReminderPreferences';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

function alertKey(userId: string, reminder: PaymentReminder) {
  const dueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(reminder.data_vencimento));
  return `kakebo:payment-reminder-alerted:${userId}:${reminder.id}:${dueDate}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function dueLabel(value: string) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const due = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(value));
  if (due === today) return 'vence hoje';
  return `vence em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(value))}`;
}

async function showNotification(reminder: PaymentReminder) {
  const title = reminder.tipo === 'Fatura' ? 'Fatura próxima do vencimento' : 'Conta próxima do vencimento';
  const options: NotificationOptions = {
    body: `${reminder.descricao} (${reminder.conta_nome}) — ${formatCurrency(reminder.valor)}; ${dueLabel(reminder.data_vencimento)}.`,
    tag: `kakebo:${reminder.id}`,
    renotify: false,
  };

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    return;
  }
  new Notification(title, options);
}

export function PaymentReminderNotifications() {
  const { usuario } = useAuth();

  const checkReminders = useCallback(async () => {
    if (!usuario || !('Notification' in window) || Notification.permission !== 'granted') return;
    const preferences = getPaymentReminderPreferences(usuario.id);
    if (!preferences.enabled) return;

    const reminders = await notificacoesService.listarContasAPagar(preferences.daysAhead);
    for (const reminder of reminders) {
      const key = alertKey(usuario.id, reminder);
      if (localStorage.getItem(key)) continue;
      await showNotification(reminder);
      localStorage.setItem(key, 'true');
    }
  }, [usuario]);

  useEffect(() => {
    void checkReminders().catch(() => undefined);
    const interval = window.setInterval(() => void checkReminders().catch(() => undefined), CHECK_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkReminders().catch(() => undefined);
    };
    const unsubscribe = onPaymentReminderPreferencesChange((userId) => {
      if (userId === usuario?.id) void checkReminders().catch(() => undefined);
    });
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribe();
    };
  }, [checkReminders, usuario?.id]);

  return null;
}
