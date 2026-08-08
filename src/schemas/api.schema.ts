import { z } from 'zod';

const uuid = z.string().uuid();
const nome = z.string().trim().min(2).max(100);
const mes = z.coerce.number().int().min(1).max(12);
const ano = z.coerce.number().int().min(2000).max(2100);
const valor = z.coerce.number().finite().nonnegative().max(99999999.99);
const dia = z.coerce.number().int().min(1).max(31);
const idParams = z.object({ id: uuid });

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

export const painelSchema = z.object({ query: z.object({ mes, ano }) });
export const fluxoSchema = z.object({
  query: z.object({
    inicio: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    fim: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    status: z.enum(['Pendente', 'Pago', 'Ambos']).optional(), conta_id: uuid.optional(),
  }).refine((data) => data.inicio <= data.fim, { message: 'O período inicial deve ser anterior ao final.' }),
});
