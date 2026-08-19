import { api } from './api';

export type FuelForecastType = 'orcamento' | 'fluxo-caixa';

export interface FuelCalculationRequest {
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

export interface FuelCalculationResult extends Required<Omit<FuelCalculationRequest, 'forecastType'>> {
  dailyDistanceKm: number;
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
export interface SavedLocation { label: string; latitude: number; longitude: number; }
export interface FuelSaveRequest extends FuelCalculationRequest { nome?: string; descricao?: string; exportToBudget?: boolean; subcategoria_id?: string; mes?: number; ano?: number; origin?: SavedLocation; destination?: SavedLocation; outboundDurationMinutes?: number; returnDurationMinutes?: number; userVehicleId?: string; fuelType?: string; }
export interface FuelScenario { id: string; nome: string | null; outbound_distance_km: number; return_distance_km: number; days_per_week: number; weeks_per_month: number; weekdays: number[]; extra_days: number; extra_margin_percent: number; fuel_efficiency_km_per_l: number; fuel_price_per_l: number; origin_label: string | null; origin_lat: number | null; origin_lng: number | null; destination_label: string | null; destination_lat: number | null; destination_lng: number | null; outbound_duration_min: number | null; return_duration_min: number | null; }
export interface FuelScenarioApplyRequest { mes: number; ano: number; destino: FuelForecastType; subcategoria_id?: string; conta_id?: string; }
export interface FuelPrice { fuel_type: 'Gasolina' | 'Etanol' | 'Diesel'; price_per_l: number; }

export const combustivelService = {
  calcular: async (payload: FuelCalculationRequest): Promise<FuelCalculationResult> => (await api.post('/combustivel/calcular', payload)).data,
  salvar: async (payload: FuelSaveRequest) =>
    (await api.post('/combustivel/salvar', payload)).data,
  listar: async (): Promise<FuelScenario[]> => (await api.get('/combustivel/cenarios')).data,
  excluir: async (id: string) => api.delete(`/combustivel/cenarios/${id}`),
  aplicar: async (id: string, payload: FuelScenarioApplyRequest) => (await api.post(`/combustivel/cenarios/${id}/aplicar`, payload)).data,
  listarPrecos: async (): Promise<FuelPrice[]> => (await api.get('/combustivel/precos')).data,
  salvarPreco: async (payload: FuelPrice): Promise<FuelPrice> => (await api.put('/combustivel/precos', payload)).data,
};
