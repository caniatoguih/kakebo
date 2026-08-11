import { addMonthsClamped } from '../finance/monthlyDate';

export interface BillingCycle {
  competence: string;
  start: Date;
  end: Date;
  closingDate: Date;
  dueDate: Date;
}

function utcDateClamped(year: number, month: number, day: number, endOfDay = false): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const date = new Date(Date.UTC(year, month, Math.min(day, lastDay)));
  if (endOfDay) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function competenceOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getCycleByClosingMonth(
  closingYear: number,
  closingMonth: number,
  closingDay: number,
  dueDay: number,
): BillingCycle {
  const closingDate = utcDateClamped(closingYear, closingMonth, closingDay);
  const previousClosing = utcDateClamped(
    addMonthsClamped(closingDate, -1, closingDay).getUTCFullYear(),
    addMonthsClamped(closingDate, -1, closingDay).getUTCMonth(),
    closingDay,
  );
  const start = previousClosing;
  const end = new Date(closingDate.getTime() - 1);

  let dueYear = closingDate.getUTCFullYear();
  let dueMonth = closingDate.getUTCMonth();
  if (dueDay <= closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
  }

  return {
    competence: competenceOf(closingDate),
    start,
    end,
    closingDate,
    dueDate: utcDateClamped(dueYear, dueMonth, dueDay, true),
  };
}

export function getBillingCycleForDate(dateInput: Date, closingDay: number, dueDay: number): BillingCycle {
  const date = new Date(dateInput);
  let closingYear = date.getUTCFullYear();
  let closingMonth = date.getUTCMonth();
  const closingThisMonth = utcDateClamped(closingYear, closingMonth, closingDay);

  if (date >= closingThisMonth) {
    closingMonth += 1;
    if (closingMonth > 11) { closingMonth = 0; closingYear += 1; }
  }
  return getCycleByClosingMonth(closingYear, closingMonth, closingDay, dueDay);
}

export function getOpenBillingCycle(now: Date, closingDay: number, dueDay: number): BillingCycle {
  return getBillingCycleForDate(now, closingDay, dueDay);
}

export function getLastClosedBillingCycle(now: Date, closingDay: number, dueDay: number): BillingCycle {
  const open = getOpenBillingCycle(now, closingDay, dueDay);
  const previousClosing = addMonthsClamped(open.closingDate, -1, closingDay);
  return getCycleByClosingMonth(previousClosing.getUTCFullYear(), previousClosing.getUTCMonth(), closingDay, dueDay);
}

export function getCashFlowMonthForCardTransaction(
  date: Date,
  closingDay: number,
  dueDay = closingDay,
  invoiceDueDate?: Date | null,
): string {
  // Para compras vinculadas, o vencimento persistido na fatura e a fonte de
  // verdade. O calculo pelo cartao permanece como compatibilidade com legados.
  if (invoiceDueDate) return competenceOf(new Date(invoiceDueDate));
  const cycle = getBillingCycleForDate(date, closingDay, dueDay);
  return competenceOf(cycle.dueDate);
}

export function isLegacyInvoicePayment(description: string): boolean {
  const normalized = (description || '').toLocaleLowerCase('pt-BR');
  return normalized.includes('pagamento fatura') || normalized.includes('liquidação fatura') || normalized.includes('liquidacao fatura');
}
