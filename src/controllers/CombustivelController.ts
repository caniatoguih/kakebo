import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { calculateFuelScenario } from '../services/FuelCalculatorService';
import { assertSubcategoryOwnership } from '../services/OwnershipService';

const calculationPayload = (body: Record<string, unknown>) => ({
  outboundDistanceKm: Number(body.outboundDistanceKm),
  returnDistanceKm: Number(body.returnDistanceKm),
  daysPerWeek: body.daysPerWeek === undefined ? undefined : Number(body.daysPerWeek),
  tripDays: body.tripDays === undefined ? undefined : Number(body.tripDays),
  weeksPerMonth: Number(body.weeksPerMonth ?? 4.33),
  extraDays: Number(body.extraDays ?? 0),
  extraMarginPercent: Number(body.extraMarginPercent ?? 0),
  weekdays: Array.isArray(body.weekdays) ? body.weekdays.map(Number) : undefined,
  referenceMonth: body.referenceMonth === undefined ? undefined : Number(body.referenceMonth),
  referenceYear: body.referenceYear === undefined ? undefined : Number(body.referenceYear),
  fuelEfficiencyKmPerLiter: Number(body.fuelEfficiencyKmPerLiter),
  fuelPricePerLiter: Number(body.fuelPricePerLiter),
  forecastType: body.forecastType as 'orcamento' | 'fluxo-caixa' | undefined,
});

export class CombustivelController {
  listPrices = async (req: Request, res: Response) => {
    const prices = await prisma.fuelPrice.findMany({ where: { usuario_id: req.usuario_id! }, orderBy: { fuel_type: 'asc' } });
    return res.json(prices.map((price) => ({ fuel_type: price.fuel_type, price_per_l: Number(price.price_per_l) })));
  };

  savePrice = async (req: Request, res: Response) => {
    const price = await prisma.fuelPrice.upsert({
      where: { usuario_id_fuel_type: { usuario_id: req.usuario_id!, fuel_type: req.body.fuel_type } },
      update: { price_per_l: req.body.price_per_l },
      create: { usuario_id: req.usuario_id!, fuel_type: req.body.fuel_type, price_per_l: req.body.price_per_l },
    });
    return res.json({ fuel_type: price.fuel_type, price_per_l: Number(price.price_per_l) });
  };
  list = async (req: Request, res: Response) => {
    const scenarios = await prisma.fuelScenario.findMany({ where: { usuario_id: req.usuario_id! }, orderBy: { updated_at: 'desc' }, take: 50 });
    return res.json(scenarios.map((scenario) => ({
      ...scenario,
      outbound_distance_km: Number(scenario.outbound_distance_km), return_distance_km: Number(scenario.return_distance_km),
      days_per_week: Number(scenario.days_per_week), weeks_per_month: Number(scenario.weeks_per_month),
      extra_margin_percent: Number(scenario.extra_margin_percent), fuel_efficiency_km_per_l: Number(scenario.fuel_efficiency_km_per_l),
      fuel_price_per_l: Number(scenario.fuel_price_per_l), monthly_distance_km: Number(scenario.monthly_distance_km),
      monthly_cost: Number(scenario.monthly_cost), suggested_budget: Number(scenario.suggested_budget), annual_cost: Number(scenario.annual_cost),
      origin_lat: scenario.origin_lat === null ? null : Number(scenario.origin_lat), origin_lng: scenario.origin_lng === null ? null : Number(scenario.origin_lng),
      destination_lat: scenario.destination_lat === null ? null : Number(scenario.destination_lat), destination_lng: scenario.destination_lng === null ? null : Number(scenario.destination_lng),
      outbound_duration_min: scenario.outbound_duration_min === null ? null : Number(scenario.outbound_duration_min), return_duration_min: scenario.return_duration_min === null ? null : Number(scenario.return_duration_min),
    })));
  };

  delete = async (req: Request, res: Response) => {
    const deleted = await prisma.fuelScenario.deleteMany({ where: { id: req.params.id, usuario_id: req.usuario_id! } });
    if (!deleted.count) return res.status(404).json({ message: 'Cenário não encontrado.' });
    return res.status(204).send();
  };

  apply = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { mes, ano, subcategoria_id, conta_id, destino } = req.body;
    try {
      const scenario = await prisma.fuelScenario.findFirst({ where: { id: req.params.id, usuario_id } });
      if (!scenario) return res.status(404).json({ message: 'Cenário não encontrado.' });
      const calc = calculateFuelScenario({
        outboundDistanceKm: Number(scenario.outbound_distance_km), returnDistanceKm: Number(scenario.return_distance_km),
        daysPerWeek: Number(scenario.days_per_week), weeksPerMonth: Number(scenario.weeks_per_month), extraDays: scenario.extra_days,
        extraMarginPercent: Number(scenario.extra_margin_percent), weekdays: scenario.weekdays, referenceMonth: mes, referenceYear: ano,
        fuelEfficiencyKmPerLiter: Number(scenario.fuel_efficiency_km_per_l), fuelPricePerLiter: Number(scenario.fuel_price_per_l), forecastType: destino,
      });
      if (destino === 'orcamento') {
        await assertSubcategoryOwnership(subcategoria_id, usuario_id);
        const allocation = await prisma.$transaction(async (tx) => {
          await tx.fuelScenarioBudgetAllocation.upsert({
            where: { fuel_scenario_id_mes_ano: { fuel_scenario_id: scenario.id, mes, ano } },
            update: { usuario_id, subcategoria_id, valor_orcado: calc.suggestedBudget },
            create: { usuario_id, fuel_scenario_id: scenario.id, subcategoria_id, mes, ano, valor_orcado: calc.suggestedBudget },
          });
          const total = await tx.fuelScenarioBudgetAllocation.aggregate({ where: { usuario_id, subcategoria_id, mes, ano }, _sum: { valor_orcado: true } });
          const budget = await tx.orcamento.upsert({
            where: { usuario_id_subcategoria_id_mes_ano: { usuario_id, subcategoria_id, mes, ano } },
            update: { valor_orcado: total._sum.valor_orcado ?? 0 },
            create: { usuario_id, subcategoria_id, mes, ano, valor_orcado: total._sum.valor_orcado ?? 0 },
          });
          return { budget, total: Number(total._sum.valor_orcado ?? 0) };
        });
        return res.status(201).json({ destino, valor: allocation.total, calculo: calc, orcamento: allocation.budget });
      }
      const conta = await prisma.contaBancaria.findFirst({ where: { id: conta_id, usuario_id } });
      if (!conta) return res.status(404).json({ message: 'Conta não encontrada.' });
      // Ao meio-dia UTC a data permanece no mês selecionado em fusos do Brasil.
      const forecastDate = new Date(Date.UTC(ano, mes - 1, 1, 12));
      const forecast = await prisma.$transaction(async (tx) => {
        const existing = await tx.fuelScenarioCashflowForecast.findFirst({ where: { fuel_scenario_id: scenario.id, mes, ano } });
        if (existing) {
          const transaction = await tx.transacao.update({ where: { id: existing.transacao_id }, data: { valor: calc.suggestedBudget, descricao: `Combustível previsto · ${scenario.nome || 'Cenário'}`, data_transacao: forecastDate } });
          return { transaction, created: false };
        }
        const transaction = await tx.transacao.create({ data: {
          usuario_id, conta_id: conta.id, subcategoria_id: scenario.mapped_subcategoria_id, descricao: `Combustível previsto · ${scenario.nome || 'Cenário'}`,
          valor: calc.suggestedBudget, tipo: 'Despesa', status: 'Pendente', data_transacao: forecastDate, recorrente: false,
        }});
        await tx.fuelScenarioCashflowForecast.create({ data: { usuario_id, fuel_scenario_id: scenario.id, transacao_id: transaction.id, mes, ano } });
        return { transaction, created: true };
      });
      return res.status(201).json({ destino, valor: calc.suggestedBudget, calculo: calc, fluxo: forecast });
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Não foi possível aplicar o cenário.' });
    }
  };

  calculate = async (req: Request, res: Response) => {
    try {
      return res.json(calculateFuelScenario(calculationPayload(req.body)));
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Erro ao calcular combustível.' });
    }
  };

  save = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    try {
      const payload = calculationPayload(req.body);
      const calc = calculateFuelScenario(payload);
      if (req.body.subcategoria_id) await assertSubcategoryOwnership(req.body.subcategoria_id, usuario_id);

      const saved = await prisma.$transaction(async (tx) => {
        const scenario = await tx.fuelScenario.create({
          data: {
            usuario_id, nome: req.body.nome || null, descricao: req.body.descricao || null,
            user_vehicle_id: req.body.userVehicleId ?? null, fuel_type: req.body.fuelType ?? null,
            origin_label: req.body.origin?.label ?? null, origin_lat: req.body.origin?.latitude ?? null, origin_lng: req.body.origin?.longitude ?? null,
            destination_label: req.body.destination?.label ?? null, destination_lat: req.body.destination?.latitude ?? null, destination_lng: req.body.destination?.longitude ?? null,
            outbound_distance_km: payload.outboundDistanceKm, return_distance_km: payload.returnDistanceKm,
            outbound_duration_min: req.body.outboundDurationMinutes ?? null, return_duration_min: req.body.returnDurationMinutes ?? null,
            days_per_week: payload.daysPerWeek ?? 5, weeks_per_month: payload.weeksPerMonth,
            weekdays: payload.weekdays ?? [],
            extra_days: payload.extraDays, extra_margin_percent: payload.extraMarginPercent,
            fuel_efficiency_km_per_l: payload.fuelEfficiencyKmPerLiter, fuel_price_per_l: payload.fuelPricePerLiter,
            monthly_distance_km: calc.monthlyDistanceKm, monthly_cost: calc.monthlyCost,
            suggested_budget: calc.suggestedBudget, annual_cost: calc.annualCost, forecast_type: calc.forecastType,
            mapped_subcategoria_id: req.body.subcategoria_id ?? null, mapped_mes: req.body.mes ?? null, mapped_ano: req.body.ano ?? null,
          },
        });
        if (req.body.exportToBudget) {
          await tx.fuelScenarioBudgetAllocation.upsert({
            where: { fuel_scenario_id_mes_ano: { fuel_scenario_id: scenario.id, mes: req.body.mes, ano: req.body.ano } },
            update: { usuario_id, subcategoria_id: req.body.subcategoria_id, valor_orcado: calc.suggestedBudget },
            create: { usuario_id, fuel_scenario_id: scenario.id, subcategoria_id: req.body.subcategoria_id, mes: req.body.mes, ano: req.body.ano, valor_orcado: calc.suggestedBudget },
          });
          const total = await tx.fuelScenarioBudgetAllocation.aggregate({ where: { usuario_id, subcategoria_id: req.body.subcategoria_id, mes: req.body.mes, ano: req.body.ano }, _sum: { valor_orcado: true } });
          await tx.orcamento.upsert({
            where: { usuario_id_subcategoria_id_mes_ano: { usuario_id, subcategoria_id: req.body.subcategoria_id, mes: req.body.mes, ano: req.body.ano } },
            update: { valor_orcado: total._sum.valor_orcado ?? 0 },
            create: { usuario_id, subcategoria_id: req.body.subcategoria_id, mes: req.body.mes, ano: req.body.ano, valor_orcado: total._sum.valor_orcado ?? 0 },
          });
        }
        return scenario;
      });
      return res.status(201).json(saved);
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Erro ao salvar cenário de combustível.' });
    }
  };
}
