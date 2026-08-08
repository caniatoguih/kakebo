import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
}));

vi.mock('../src/lib/prisma', () => ({
  default: {
    transacao: { count: mocks.count, findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}));

import { TransacaoRepository } from '../src/repositories/TransacaoRepository';

describe('paginação de transações no banco', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(125);
    mocks.findMany.mockResolvedValue([{ id: 'transaction-51' }]);
  });

  it('aplica filtro, skip e take antes de obter os registros', async () => {
    const result = await new TransacaoRepository().findByFilters({
      usuario_id: 'user-1',
      conta_id: 'account-1',
      mes: 8,
      ano: 2026,
      page: 3,
      limit: 25,
    });

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 50,
      take: 25,
      where: expect.objectContaining({
        usuario_id: 'user-1',
        AND: expect.any(Array),
      }),
    }));
    expect(mocks.count).toHaveBeenCalledWith({ where: mocks.findMany.mock.calls[0][0].where });
    expect(result).toEqual({ total: 125, transacoes: [{ id: 'transaction-51' }] });
  });

  it('não cria filtro mensal quando mês e ano não são informados', async () => {
    await new TransacaoRepository().findByFilters({
      usuario_id: 'user-1', page: 1, limit: 50,
    });
    expect(mocks.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      usuario_id: 'user-1', AND: expect.any(Array),
    }));
  });

  it('filtra a paginação por subcategoria', async () => {
    await new TransacaoRepository().findByFilters({ usuario_id: 'user-1', subcategoria_id: 'subcategory-1', page: 1, limit: 25 });
    expect(mocks.findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ subcategoria_id: 'subcategory-1' }));
  });
});
