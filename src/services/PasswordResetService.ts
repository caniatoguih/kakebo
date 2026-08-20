import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

const TOKEN_VALIDITY_MS = 30 * 60 * 1000;

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createPasswordResetToken(usuarioId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashPasswordResetToken(token);

  await prisma.$transaction([
    prisma.tokenRedefinicaoSenha.deleteMany({ where: { usuario_id: usuarioId } }),
    prisma.tokenRedefinicaoSenha.create({
      data: {
        usuario_id: usuarioId,
        token_hash: tokenHash,
        expira_em: new Date(Date.now() + TOKEN_VALIDITY_MS),
      },
    }),
  ]);

  return token;
}

export async function discardPasswordResetToken(token: string): Promise<void> {
  await prisma.tokenRedefinicaoSenha.deleteMany({
    where: { token_hash: hashPasswordResetToken(token) },
  });
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  const record = await prisma.tokenRedefinicaoSenha.findFirst({
    where: {
      token_hash: tokenHash,
      usado_em: null,
      expira_em: { gt: now },
    },
    select: { id: true, usuario_id: true },
  });

  if (!record) return false;

  const passwordHash = await bcrypt.hash(newPassword, 12);

  try {
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.tokenRedefinicaoSenha.updateMany({
        where: { id: record.id, usado_em: null, expira_em: { gt: now } },
        data: { usado_em: now },
      });
      if (consumed.count !== 1) throw new Error('TOKEN_ALREADY_CONSUMED');

      await transaction.usuario.update({
        where: { id: record.usuario_id },
        data: { senha_hash: passwordHash },
      });
      await transaction.tokenRedefinicaoSenha.updateMany({
        where: { usuario_id: record.usuario_id, usado_em: null },
        data: { usado_em: now },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_ALREADY_CONSUMED') return false;
    throw error;
  }

  return true;
}
