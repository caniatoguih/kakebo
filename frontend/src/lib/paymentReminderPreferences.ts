export interface PaymentReminderPreferences {
  enabled: boolean;
  daysAhead: number;
}

const SETTINGS_EVENT = 'kakebo:payment-reminder-settings';

const defaults: PaymentReminderPreferences = { enabled: false, daysAhead: 3 };

function storageKey(userId: string) {
  return `kakebo:payment-reminders:${userId}`;
}

export function getPaymentReminderPreferences(userId: string): PaymentReminderPreferences {
  try {
    const value = localStorage.getItem(storageKey(userId));
    if (!value) return defaults;
    const parsed = JSON.parse(value) as Partial<PaymentReminderPreferences>;
    return {
      enabled: Boolean(parsed.enabled),
      daysAhead: Math.min(14, Math.max(0, Number(parsed.daysAhead) || defaults.daysAhead)),
    };
  } catch {
    return defaults;
  }
}

export function savePaymentReminderPreferences(userId: string, preferences: PaymentReminderPreferences) {
  localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: userId }));
}

export function onPaymentReminderPreferencesChange(listener: (userId: string) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(SETTINGS_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_EVENT, handler);
}
