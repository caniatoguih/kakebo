import { describe, expect, it } from 'vitest';
import { calculateFuelScenario } from '../src/services/FuelCalculatorService';

describe('FuelCalculatorService', () => {
  it('calcula ida e volta separadamente, incluindo rotina, margem e reserva', () => {
    const result = calculateFuelScenario({
      outboundDistanceKm: 5.55, returnDistanceKm: 5.22, daysPerWeek: 5, weeksPerMonth: 4.33,
      extraDays: 0, extraMarginPercent: 0, fuelEfficiencyKmPerLiter: 10.2, fuelPricePerLiter: 6.2,
    });
    expect(result.dailyDistanceKm).toBeCloseTo(10.77, 2);
    expect(result.workingDaysMonth).toBeCloseTo(21.65, 2);
    expect(result.monthlyDistanceKm).toBeCloseTo(233.17, 2);
    expect(result.monthlyLiters).toBeCloseTo(22.86, 2);
    expect(result.suggestedBudget).toBe(150);
  });

  it('aplica dias extras e margem na quilometragem mensal', () => {
    const result = calculateFuelScenario({
      outboundDistanceKm: 10, returnDistanceKm: 12, daysPerWeek: 5, weeksPerMonth: 4,
      extraDays: 1, extraMarginPercent: 10, fuelEfficiencyKmPerLiter: 11, fuelPricePerLiter: 5,
    });
    expect(result.workingDaysMonth).toBe(21);
    expect(result.monthlyDistanceKm).toBeCloseTo(508.2, 2);
  });

  it('rejeita dados inválidos em vez de criar uma estimativa silenciosa', () => {
    expect(() => calculateFuelScenario({ outboundDistanceKm: 0, returnDistanceKm: 1, daysPerWeek: 5, weeksPerMonth: 4, fuelEfficiencyKmPerLiter: 10, fuelPricePerLiter: 5 })).toThrow();
  });
});
