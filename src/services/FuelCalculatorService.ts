export type FuelForecastType = 'orcamento' | 'fluxo-caixa';

export interface FuelCalculationInput {
  outboundDistanceKm: number;
  returnDistanceKm: number;
  daysPerWeek?: number;
  tripDays?: number;
  weeksPerMonth?: number;
  extraDays?: number;
  extraMarginPercent?: number;
  weekdays?: number[];
  referenceMonth?: number;
  referenceYear?: number;
  fuelEfficiencyKmPerLiter: number;
  fuelPricePerLiter: number;
  forecastType?: FuelForecastType;
}

export interface FuelCalculationResult {
  outboundDistanceKm: number;
  returnDistanceKm: number;
  dailyDistanceKm: number;
  daysPerWeek?: number;
  tripDays?: number;
  weeksPerMonth: number;
  extraDays: number;
  extraMarginPercent: number;
  weekdays: number[];
  referenceMonth?: number;
  referenceYear?: number;
  workingDaysMonth: number;
  monthlyDistanceKm: number;
  monthlyLiters: number;
  costPerKm: number;
  costPerWorkingDay: number;
  monthlyCost: number;
  suggestedBudget: number;
  annualCost: number;
  forecastType: FuelForecastType;
}

export const calculateFuelScenario = (input: FuelCalculationInput): FuelCalculationResult => {
  const requiredPositive = (value: number, field: string) => {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} deve ser maior que zero.`);
    return value;
  };
  const nonNegative = (value: number | undefined, field: string) => {
    const normalized = value ?? 0;
    if (!Number.isFinite(normalized) || normalized < 0) throw new Error(`${field} não pode ser negativo.`);
    return normalized;
  };

  const outboundDistanceKm = requiredPositive(input.outboundDistanceKm, 'A distância de ida');
  const returnDistanceKm = requiredPositive(input.returnDistanceKm, 'A distância de volta');
  const daysPerWeek = requiredPositive(input.daysPerWeek ?? 5, 'Os dias por semana');
  const tripDays = input.tripDays === undefined ? undefined : requiredPositive(input.tripDays, 'Os dias da viagem');
  const weeksPerMonth = requiredPositive(input.weeksPerMonth ?? 4.33, 'As semanas por mês');
  const extraDays = nonNegative(input.extraDays, 'Os dias extras');
  const extraMarginPercent = nonNegative(input.extraMarginPercent, 'A margem adicional');
  const fuelEfficiencyKmPerLiter = requiredPositive(input.fuelEfficiencyKmPerLiter, 'O consumo médio');
  const fuelPricePerLiter = nonNegative(input.fuelPricePerLiter, 'O preço do combustível');
  const weekdays = [...new Set(input.weekdays ?? [])].sort();
  if (weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 1 || weekday > 7)) throw new Error('Os dias da semana são inválidos.');
  const referenceMonth = input.referenceMonth;
  const referenceYear = input.referenceYear;
  if ((referenceMonth !== undefined || referenceYear !== undefined) && (!Number.isInteger(referenceMonth) || !Number.isInteger(referenceYear) || referenceMonth! < 1 || referenceMonth! > 12 || referenceYear! < 2000 || referenceYear! > 2100)) throw new Error('O mês de referência é inválido.');
  const forecastType = input.forecastType ?? 'orcamento';
  const dailyDistanceKm = outboundDistanceKm + returnDistanceKm;
  const calendarDays = weekdays.length && referenceMonth && referenceYear
    ? Array.from({ length: new Date(Date.UTC(referenceYear, referenceMonth, 0)).getUTCDate() }, (_, index) => {
      const weekday = new Date(Date.UTC(referenceYear, referenceMonth - 1, index + 1)).getUTCDay() || 7;
      return weekdays.includes(weekday) ? 1 : 0;
    }).reduce<number>((total, day) => total + day, 0)
    : null;
  const workingDaysMonth = tripDays ?? ((calendarDays ?? daysPerWeek * weeksPerMonth) + extraDays);
  const monthlyDistanceKm = dailyDistanceKm * workingDaysMonth * (1 + extraMarginPercent / 100);
  const monthlyLiters = monthlyDistanceKm / fuelEfficiencyKmPerLiter;
  const monthlyCost = monthlyLiters * fuelPricePerLiter;

  return {
    outboundDistanceKm, returnDistanceKm, dailyDistanceKm, daysPerWeek, weeksPerMonth, tripDays, extraDays, extraMarginPercent, weekdays, referenceMonth, referenceYear,
    workingDaysMonth, monthlyDistanceKm, monthlyLiters,
    costPerKm: fuelPricePerLiter / fuelEfficiencyKmPerLiter,
    costPerWorkingDay: monthlyCost / workingDaysMonth,
    monthlyCost, suggestedBudget: Math.ceil(monthlyCost / 10) * 10, annualCost: monthlyCost * 12, forecastType,
  };
};
