import { afterEach, describe, expect, it } from 'vitest';
import { getJwtSecret } from '../src/config/security';
import { loginSchema, createContaSchema, batchOrcamentoSchema, fluxoSchema, forgotPasswordSchema, resetPasswordSchema } from '../src/schemas/api.schema';
import { importTransactionsSchema, listTransacoesSchema } from '../src/schemas/transacao.schema';
import prisma from '../src/lib/prisma';
import { assertAccountOwnership, assertSubcategoryOwnership } from '../src/services/OwnershipService';

vi.mock('../src/lib/prisma', () => ({
  default: {
    contaBancaria: { findFirst: vi.fn() },
    subcategoria: { findFirst: vi.fn() },
  },
}));

const originalSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe('configuração de segurança', () => {
  it('rejeita segredo JWT ausente ou fraco', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow();
    process.env.JWT_SECRET = 'secret';
    expect(() => getJwtSecret()).toThrow();
  });

  it('aceita segredo JWT forte', () => {
    process.env.JWT_SECRET = 'a'.repeat(48);
    expect(getJwtSecret()).toHaveLength(48);
  });
});

describe('validação das entradas', () => {
  it('normaliza e-mail de login', () => {
    const result = loginSchema.parse({ body: { email: ' USER@EXAMPLE.COM ', senha: '12345678' } });
    expect(result.body.email).toBe('user@example.com');
  });

  it('valida as entradas de recuperação de senha', () => {
    const request = forgotPasswordSchema.parse({ body: { email: ' USER@EXAMPLE.COM ' } });
    expect(request.body.email).toBe('user@example.com');
    expect(() => resetPasswordSchema.parse({ body: { token: 'a'.repeat(64), senha: '12345678' } })).not.toThrow();
    expect(() => resetPasswordSchema.parse({ body: { token: 'token-invalido', senha: '12345678' } })).toThrow();
    expect(() => resetPasswordSchema.parse({ body: { token: 'a'.repeat(64), senha: 'curta' } })).toThrow();
  });

  it('exige os detalhes de um cartão', () => {
    expect(() => createContaSchema.parse({ body: { nome: 'Cartão', tipo: 'CartaoCredito', saldo_inicial: 0 } })).toThrow();
  });

  it('limita paginação e operações em lote', () => {
    expect(() => listTransacoesSchema.parse({ query: { limit: '100' } })).not.toThrow();
    expect(() => listTransacoesSchema.parse({ query: { limit: '101' } })).toThrow();
    expect(() => batchOrcamentoSchema.parse({ body: { items: [] } })).toThrow();
  });

  it('aceita filtro de subcategoria válido', () => {
    expect(() => listTransacoesSchema.parse({ query: { subcategoria_id: 'bbd58cbe-6b74-49eb-babd-e2f76f1fd27b' } })).not.toThrow();
    expect(() => listTransacoesSchema.parse({ query: { subcategoria_id: 'inválido' } })).toThrow();
  });

  it('rejeita importação vazia', () => {
    expect(() => importTransactionsSchema.parse({
      body: { conta_id: 'bbd58cbe-6b74-49eb-babd-e2f76f1fd27b', transacoes: [] },
    })).toThrow();
  });

  it('aceita relatório contábil com transações pagas e pendentes', () => {
    expect(() => fluxoSchema.parse({
      query: { inicio: '2026-01', fim: '2026-12', status: 'Ambos' },
    })).not.toThrow();
  });
});

describe('isolamento entre usuários', () => {
  it('rejeita conta que não pertence ao usuário', async () => {
    vi.mocked(prisma.contaBancaria.findFirst).mockResolvedValue(null);
    await expect(assertAccountOwnership('conta-alheia', 'usuario')).rejects.toThrow('Conta bancária não encontrada.');
    expect(prisma.contaBancaria.findFirst).toHaveBeenCalledWith({
      where: { id: 'conta-alheia', usuario_id: 'usuario' },
    });
  });

  it('rejeita subcategoria que não pertence ao usuário', async () => {
    vi.mocked(prisma.subcategoria.findFirst).mockResolvedValue(null);
    await expect(assertSubcategoryOwnership('subcategoria-alheia', 'usuario')).rejects.toThrow('Subcategoria não encontrada.');
    expect(prisma.subcategoria.findFirst).toHaveBeenCalledWith({
      where: { id: 'subcategoria-alheia', categoria: { usuario_id: 'usuario' } },
    });
  });
});
