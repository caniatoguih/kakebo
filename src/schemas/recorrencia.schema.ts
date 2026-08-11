import { z } from 'zod';

const uuid = z.string().uuid();

export const listRecorrenciasSchema = z.object({
  query: z.object({
    busca: z.string().trim().max(100).optional(),
    tipo: z.enum(['Receita', 'Despesa', 'Transferencia']).optional(),
    conta_id: uuid.optional(),
    situacao: z.enum(['Ativa', 'Encerrada', 'Inconsistente']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const recorrenciaIdSchema = z.object({ params: z.object({ id: uuid }) });

const changeValueBody = z.object({
  novo_valor: z.coerce.number().positive().max(99999999.99),
  competencia_inicial: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  escopo: z.enum(['SomenteCompetencia', 'DestaCompetenciaEmDiante']),
});

export const simulateRecurrenceChangeSchema = z.object({
  params: z.object({ id: uuid }),
  body: changeValueBody,
});

export const executeRecurrenceChangeSchema = z.object({
  params: z.object({ id: uuid }),
  body: changeValueBody.extend({
    simulacao_id: z.string().regex(/^[a-f0-9]{64}$/),
    confirmar_faturas_fechadas: z.boolean().default(false),
  }),
});
