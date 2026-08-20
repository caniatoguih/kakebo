import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tokenRedefinicaoSenha: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  usuario: { update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({ default: prismaMock }));

import {
  createPasswordResetToken,
  hashPasswordResetToken,
  resetPasswordWithToken,
} from '../src/services/PasswordResetService';

describe('recuperação de senha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tokenRedefinicaoSenha.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.tokenRedefinicaoSenha.create.mockResolvedValue({ id: 'token-id' });
    prismaMock.$transaction.mockImplementation(async (operation: any) => {
      if (typeof operation === 'function') return operation(prismaMock);
      return Promise.all(operation);
    });
  });

  it('armazena somente o hash de um token aleatório com validade de 30 minutos', async () => {
    const before = Date.now();
    const token = await createPasswordResetToken('usuario-1');

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(prismaMock.tokenRedefinicaoSenha.create).toHaveBeenCalledOnce();
    const createCall = prismaMock.tokenRedefinicaoSenha.create.mock.calls[0][0];
    expect(createCall.data.token_hash).toBe(hashPasswordResetToken(token));
    expect(createCall.data.token_hash).not.toBe(token);
    expect(createCall.data.expira_em.getTime()).toBeGreaterThanOrEqual(before + 30 * 60 * 1000);
  });

  it('rejeita token ausente, expirado ou já utilizado', async () => {
    prismaMock.tokenRedefinicaoSenha.findFirst.mockResolvedValue(null);

    await expect(resetPasswordWithToken('a'.repeat(64), 'nova-senha-segura')).resolves.toBe(false);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it('troca a senha e invalida os demais tokens em uma transação', async () => {
    prismaMock.tokenRedefinicaoSenha.findFirst.mockResolvedValue({ id: 'token-id', usuario_id: 'usuario-1' });
    prismaMock.tokenRedefinicaoSenha.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });
    prismaMock.usuario.update.mockResolvedValue({ id: 'usuario-1' });

    await expect(resetPasswordWithToken('b'.repeat(64), 'nova-senha-segura')).resolves.toBe(true);
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'usuario-1' },
      data: { senha_hash: expect.any(String) },
    });
    expect(prismaMock.tokenRedefinicaoSenha.updateMany).toHaveBeenLastCalledWith({
      where: { usuario_id: 'usuario-1', usado_em: null },
      data: { usado_em: expect.any(Date) },
    });
  });
});
