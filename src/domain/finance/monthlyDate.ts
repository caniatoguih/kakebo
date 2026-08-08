export function addMonthsClamped(source: Date, months: number, anchorDay = source.getUTCDate()): Date {
  if (!Number.isInteger(months)) throw new Error('Quantidade de meses inválida.');
  const result = new Date(source);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(anchorDay, lastDay));
  return result;
}
