import prisma from '../lib/prisma';
import { calculateAccountBalanceCents } from '../domain/finance/balanceImpact';
import { toCents } from '../domain/finance/money';

async function main(): Promise<void> {
  const userArg = process.argv.find((arg) => arg.startsWith('--user='));
  const usuarioId = userArg?.slice('--user='.length);
  const accounts = await prisma.contaBancaria.findMany({
    where: usuarioId ? { usuario_id: usuarioId } : undefined,
    include: { transacoes_origem: true },
    orderBy: { id: 'asc' },
  });

  const divergences = accounts.flatMap((account) => {
    const expected = calculateAccountBalanceCents(account.tipo, account.saldo_inicial, account.transacoes_origem);
    const stored = toCents(account.saldo_atual);
    return expected === stored ? [] : [{
      conta_id: account.id,
      usuario_id: account.usuario_id,
      tipo: account.tipo,
      saldo_armazenado_centavos: stored,
      saldo_calculado_centavos: expected,
      diferenca_centavos: stored - expected,
    }];
  });

  console.log(JSON.stringify({ contas_verificadas: accounts.length, divergencias: divergences }, null, 2));
  if (divergences.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
}).finally(() => prisma.$disconnect());
