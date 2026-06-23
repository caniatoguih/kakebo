import { z } from 'zod';
import { TipoTransacao } from '../domain/enums/TipoTransacao';

const emptyToNull = (val: any) => (val === '' ? null : val);

export const createTransacaoSchema = z.object({
  body: z.object({
    conta_id: z.string().uuid(),
    subcategoria_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    descricao: z.string().min(3),
    valor: z.number().positive(),
    tipo: z.nativeEnum(TipoTransacao),
    data_transacao: z.string().datetime(), // ISO 8601
    status: z.enum(['Pendente', 'Pago']),
    total_parcelas: z.number().int().min(1).default(1),
  })
});

export const listTransacoesSchema = z.object({
  query: z.object({
    mes: z.string().regex(/^(0?[1-9]|1[012])$/, "Mês inválido").optional(),
    ano: z.string().regex(/^\d{4}$/, "Ano inválido").optional(),
    conta_id: z.string().uuid().optional(),
    page: z.string().regex(/^\d+$/).optional().default("1"),
    limit: z.string().regex(/^\d+$/).optional().default("10"),
  })
});

export const updateTransacaoSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    conta_id: z.string().uuid(),
    subcategoria_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    descricao: z.string().min(3),
    valor: z.number().positive(),
    tipo: z.nativeEnum(TipoTransacao),
    data_transacao: z.string().datetime(), // ISO 8601
    status: z.enum(['Pendente', 'Pago']),
  })
});
