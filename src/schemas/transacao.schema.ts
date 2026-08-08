import { z } from 'zod';
import { TipoTransacao } from '../domain/enums/TipoTransacao';

const emptyToNull = (val: any) => (val === '' ? null : val);

export const createTransacaoSchema = z.object({
  body: z.object({
    conta_id: z.string().uuid(),
    conta_destino_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    subcategoria_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    descricao: z.string().trim().min(3).max(255),
    valor: z.number().positive().max(99999999.99),
    tipo: z.nativeEnum(TipoTransacao),
    data_transacao: z.string().datetime(), // ISO 8601
    status: z.enum(['Pendente', 'Pago']),
    total_parcelas: z.number().int().min(1).max(600).default(1),
    recorrente: z.boolean().optional().default(false),
  }).superRefine((data, ctx) => {
    if (data.tipo !== TipoTransacao.TRANSFERENCIA) return;
    if (!data.conta_destino_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conta_destino_id'], message: 'Selecione a conta de destino.' });
    } else if (data.conta_destino_id === data.conta_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conta_destino_id'], message: 'A conta de destino deve ser diferente da origem.' });
    }
  })
});

export const listTransacoesSchema = z.object({
  query: z.object({
    mes: z.string().regex(/^(0?[1-9]|1[012])$/, "Mês inválido").optional(),
    ano: z.string().regex(/^\d{4}$/, "Ano inválido").optional(),
    conta_id: z.string().uuid().optional(),
    subcategoria_id: z.string().uuid().optional(),
    busca: z.string().trim().max(100).optional(),
    status: z.enum(['Pago', 'Pendente']).optional(),
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.string().regex(/^\d+$/).optional().default("1"),
    // Algumas telas ainda filtram e conciliam o histórico no cliente. A paginação
    // integral dessas consultas está prevista na Fase 4 do plano de melhorias.
    limit: z.string().regex(/^\d+$/).refine((v) => Number(v) <= 100, 'Limite máximo de 100 itens.').optional().default("25"),
  })
});

export const updateTransacaoSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    conta_id: z.string().uuid(),
    conta_destino_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    subcategoria_id: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    descricao: z.string().trim().min(3).max(255),
    valor: z.number().positive().max(99999999.99),
    tipo: z.nativeEnum(TipoTransacao),
    data_transacao: z.string().datetime(), // ISO 8601
    status: z.enum(['Pendente', 'Pago']),
  }).superRefine((data, ctx) => {
    if (data.tipo !== TipoTransacao.TRANSFERENCIA) return;
    if (!data.conta_destino_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conta_destino_id'], message: 'Selecione a conta de destino.' });
    } else if (data.conta_destino_id === data.conta_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['conta_destino_id'], message: 'A conta de destino deve ser diferente da origem.' });
    }
  })
});

const uuid = z.string().uuid();
const validDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida.');
const idParams = z.object({ id: uuid });
const importedTransaction = z.object({
  descricao: z.string().trim().min(1).max(255),
  valor: z.coerce.number().positive().max(99999999.99),
  tipo: z.enum(['Receita', 'Despesa', 'Transferencia']),
  data_transacao: validDate,
  status: z.enum(['Pendente', 'Pago']).optional(),
  subcategoria_id: uuid.nullable().optional(),
  conta_destino_id: uuid.optional(),
});

export const transactionIdSchema = z.object({ params: idParams });
export const closeInvoiceSchema = z.object({ body: z.object({ conta_id: uuid }) });
export const payInvoiceSchema = z.object({
  body: z.object({
    cartao_id: uuid,
    conta_origem_id: uuid,
    fatura_id: uuid.optional(),
    valor: z.coerce.number().positive().max(99999999.99),
    data_pagamento: validDate,
  }),
});
export const deleteBatchSchema = z.object({ body: z.object({ ids: z.array(uuid).min(1).max(500) }) });
export const importTransactionsSchema = z.object({
  body: z.object({ conta_id: uuid, transacoes: z.array(importedTransaction).min(1).max(5000) }),
});
export const reconcileOfxSchema = z.object({
  body: z.object({ conta_id: uuid, ofxText: z.string().min(1).max(5_000_000) }),
});
export const reconcileOfxBatchSchema = z.object({
  body: z.object({
    statements: z.array(z.object({ conta_id: uuid, ofxText: z.string().min(1).max(5_000_000) })).min(1).max(20),
  }),
});
export const convertTransferSchema = z.object({
  body: z.object({
    conta_origem_id: uuid, receita_id: uuid, descricao: z.string().trim().min(3).max(255),
    data_transacao: validDate, valor: z.coerce.number().positive().max(99999999.99),
  }),
});
export const extendRecurrenceSchema = z.object({
  body: z.object({ transacao_pai_id: uuid, novos_meses: z.coerce.number().int().min(1).max(600) }),
});
export const cancelRecurrenceSchema = z.object({
  body: z.object({ transacao_pai_id: uuid, parcela_limite: z.coerce.number().int().min(1).max(600) }),
});
