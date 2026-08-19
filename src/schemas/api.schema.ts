import { z } from 'zod';

const uuid = z.string().uuid();
const nome = z.string().trim().min(2).max(100);
const mes = z.coerce.number().int().min(1).max(12);
const ano = z.coerce.number().int().min(2000).max(2100);
const valor = z.coerce.number().finite().nonnegative().max(99999999.99);
const dia = z.coerce.number().int().min(1).max(31);
const idParams = z.object({ id: uuid });
const coordinates = z.object({ latitude: z.coerce.number().finite().min(-90).max(90), longitude: z.coerce.number().finite().min(-180).max(180) });
const savedLocation = coordinates.extend({ label: z.string().trim().min(1).max(255) });

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    senha: z.string().min(1).max(128),
  }),
});

export const registerSchema = z.object({
  body: loginSchema.shape.body.extend({ nome, senha: z.string().min(8).max(128) }),
});

export const createContaSchema = z.object({
  body: z.object({
    nome,
    tipo: z.enum(['Corrente', 'Poupanca', 'Dinheiro', 'CartaoCredito']),
    saldo_inicial: valor.default(0),
    limite_total: valor.optional(),
    dia_fechamento: dia.optional(),
    dia_vencimento: dia.optional(),
    conta_pagamento_padrao_id: uuid.nullable().optional(),
  }).superRefine((data, ctx) => {
    if (data.tipo === 'CartaoCredito') {
      for (const field of ['limite_total', 'dia_fechamento', 'dia_vencimento'] as const) {
        if (data[field] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Campo obrigatório para cartão de crédito.' });
      }
    }
  }),
});

export const updateContaSchema = z.object({
  params: idParams,
  body: z.object({
    nome: nome.optional(), saldo_inicial: valor.optional(), limite_total: valor.optional(),
    dia_fechamento: dia.optional(), dia_vencimento: dia.optional(), conta_pagamento_padrao_id: uuid.nullable().optional(),
  }).refine((data) => Object.keys(data).length > 0, 'Informe ao menos um campo.'),
});

export const contaIdSchema = z.object({ params: idParams });

export const createCategoriaSchema = z.object({
  body: z.object({
    nome, pilar: z.enum(['Sobrevivencia', 'Lazer', 'Cultura', 'Extras']),
    tipo: z.enum(['Receita', 'Despesa']), subcategorias: z.array(nome).max(100).optional(),
  }),
});
export const createSubcategoriaSchema = z.object({ params: idParams, body: z.object({ nome }) });
export const subcategoriaIdSchema = z.object({ params: z.object({ subId: uuid }) });

const budgetItem = z.object({ subcategoria_id: uuid, mes, ano, valor_orcado: valor });
export const listOrcamentoSchema = z.object({ query: z.object({ mes, ano }) });
export const upsertOrcamentoSchema = z.object({ body: budgetItem });
export const batchOrcamentoSchema = z.object({ body: z.object({ items: z.array(budgetItem).min(1).max(500) }) });
export const orcamentoIdSchema = z.object({ params: idParams });

export const fuelCalculationSchema = z.object({
  body: z.object({
    outboundDistanceKm: z.coerce.number().finite().positive().max(100000),
    returnDistanceKm: z.coerce.number().finite().positive().max(100000),
      daysPerWeek: z.coerce.number().finite().positive().max(7).default(5),
      tripDays: z.coerce.number().int().positive().max(3650).optional(),
      weeksPerMonth: z.coerce.number().finite().positive().max(12).default(4.33),
    extraDays: z.coerce.number().finite().nonnegative().max(31).default(0),
    extraMarginPercent: z.coerce.number().finite().nonnegative().max(1000).default(0),
    weekdays: z.array(z.coerce.number().int().min(1).max(7)).max(7).optional(),
    referenceMonth: mes.optional(),
    referenceYear: ano.optional(),
    fuelEfficiencyKmPerLiter: z.coerce.number().finite().positive().max(1000),
    fuelPricePerLiter: z.coerce.number().finite().nonnegative().max(9999.99),
    forecastType: z.enum(['orcamento', 'fluxo-caixa']).optional(),
  }),
});

export const fuelSaveSchema = z.object({
  body: z.object({
    nome: z.string().trim().max(200).optional(),
    descricao: z.string().trim().max(1000).optional(),
    outboundDistanceKm: z.coerce.number().finite().positive().max(100000),
    returnDistanceKm: z.coerce.number().finite().positive().max(100000),
      daysPerWeek: z.coerce.number().finite().positive().max(7).default(5),
      tripDays: z.coerce.number().int().positive().max(3650).optional(),
      weeksPerMonth: z.coerce.number().finite().positive().max(12).default(4.33),
    extraDays: z.coerce.number().finite().nonnegative().max(31).default(0),
    extraMarginPercent: z.coerce.number().finite().nonnegative().max(1000).default(0),
    weekdays: z.array(z.coerce.number().int().min(1).max(7)).max(7).optional(),
    referenceMonth: mes.optional(),
    referenceYear: ano.optional(),
    fuelEfficiencyKmPerLiter: z.coerce.number().finite().positive().max(1000),
    fuelPricePerLiter: z.coerce.number().finite().nonnegative().max(9999.99),
    forecastType: z.enum(['orcamento', 'fluxo-caixa']).optional(),
    exportToBudget: z.boolean().optional(),
    subcategoria_id: z.string().uuid().optional(),
    mes: z.coerce.number().int().min(1).max(12).optional(),
    ano: z.coerce.number().int().min(2000).max(2100).optional(),
    origin: savedLocation.optional(),
    destination: savedLocation.optional(),
    outboundDurationMinutes: z.coerce.number().finite().nonnegative().max(10000).optional(),
    returnDurationMinutes: z.coerce.number().finite().nonnegative().max(10000).optional(),
    userVehicleId: uuid.optional(),
    fuelType: z.string().trim().max(50).optional(),
  }).superRefine((data, ctx) => {
    if (data.exportToBudget && (!data.subcategoria_id || !data.mes || !data.ano)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione subcategoria, mês e ano para enviar ao orçamento.' });
    }
  }),
});

export const geocodeSchema = z.object({ query: z.object({ q: z.string().trim().min(3).max(200) }) });
export const routeSchema = z.object({ body: z.object({ origin: coordinates, destination: coordinates, profile: z.literal('car').optional() }) });
export const fuelScenarioIdSchema = z.object({ params: idParams });
export const fuelPriceSchema = z.object({
  body: z.object({
    fuel_type: z.enum(['Gasolina', 'Etanol', 'Diesel']),
    price_per_l: z.coerce.number().finite().nonnegative().max(9999.99),
  }),
});
export const fuelScenarioApplySchema = z.object({
  params: idParams,
  body: z.object({
    mes: z.coerce.number().int().min(1).max(12),
    ano: z.coerce.number().int().min(2000).max(2100),
    subcategoria_id: uuid.optional(),
    conta_id: uuid.optional(),
    destino: z.enum(['orcamento', 'fluxo-caixa']).default('orcamento'),
  }).superRefine((data, ctx) => {
    if (data.destino === 'orcamento' && !data.subcategoria_id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subcategoria_id'], message: 'Selecione a subcategoria.' });
    if (data.destino === 'fluxo-caixa' && !data.conta_id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conta_id'], message: 'Selecione a conta.' });
  }),
});
const vehicleBody = z.object({ nome: z.string().trim().min(2).max(100), marca: z.string().trim().max(100).optional(), modelo: z.string().trim().max(150).optional(), ano: z.coerce.number().int().min(1886).max(2100).optional(), fuel_type: z.enum(['Gasolina', 'Etanol', 'Flex', 'Diesel', 'GNV', 'Eletrico', 'Hibrido']), city_efficiency_km_per_l: z.coerce.number().finite().positive().max(1000), highway_efficiency_km_per_l: z.coerce.number().finite().positive().max(1000) });
export const createUserVehicleSchema = z.object({ body: vehicleBody });
export const updateUserVehicleSchema = z.object({ params: idParams, body: vehicleBody.partial().refine((data) => Object.keys(data).length > 0, 'Informe ao menos um campo.') });
export const userVehicleIdSchema = z.object({ params: idParams });

export const painelSchema = z.object({ query: z.object({ mes, ano }) });
export const fluxoSchema = z.object({
  query: z.object({
    inicio: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    fim: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    status: z.enum(['Pendente', 'Pago', 'Ambos']).optional(), conta_id: uuid.optional(),
  }).refine((data) => data.inicio <= data.fim, { message: 'O período inicial deve ser anterior ao final.' }),
});
