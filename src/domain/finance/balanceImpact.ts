import { MoneyInput, toCents } from './money';

export type AccountType = 'CartaoCredito' | string;
export type TransactionType = 'Receita' | 'Despesa' | 'Transferencia' | string;

interface BalanceImpactInput {
  accountType: AccountType;
  transactionType: TransactionType;
  status: string;
  description?: string;
  transferDirection?: 'Saida' | 'Entrada' | null;
  value: MoneyInput;
  recurring?: boolean;
  installmentNumber?: number;
}

export function calculateBalanceImpactCents(input: BalanceImpactInput): number {
  const valueCents = toCents(input.value);
  const isCreditCard = input.accountType === 'CartaoCredito';

  if ((!isCreditCard || input.transactionType === 'Transferencia') && input.status !== 'Pago') return 0;
  // Recorrências futuras são apenas previsões e não comprometem o limite antes de confirmadas.
  if (isCreditCard && input.recurring && (input.installmentNumber ?? 1) > 1 && input.status !== 'Pago') return 0;

  if (input.transactionType === 'Receita') return isCreditCard ? -valueCents : valueCents;
  if (input.transactionType === 'Despesa') return isCreditCard ? valueCents : -valueCents;
  if (input.transactionType === 'Transferencia') {
    const isOutgoing = input.transferDirection
      ? input.transferDirection === 'Saida'
      : input.description?.startsWith('[Saída]') ?? false;
    if (isOutgoing) return isCreditCard ? valueCents : -valueCents;
    return isCreditCard ? -valueCents : valueCents; 
  }

  return 0;
}

export function calculateAccountBalanceCents(
  accountType: AccountType,
  initialBalance: MoneyInput,
  transactions: Array<{
    tipo: string; status: string; descricao: string; valor: MoneyInput;
    recorrente?: boolean; parcela_atual?: number;
    transferencia_direcao?: 'Saida' | 'Entrada' | null;
  }>,
): number {
  const initialCents = accountType === 'CartaoCredito' ? 0 : toCents(initialBalance);
  return transactions.reduce((balance, transaction) => balance + calculateBalanceImpactCents({
    accountType,
    transactionType: transaction.tipo,
    status: transaction.status,
    description: transaction.descricao,
    transferDirection: transaction.transferencia_direcao,
    value: transaction.valor,
    recurring: transaction.recorrente,
    installmentNumber: transaction.parcela_atual,
  }), initialCents);
}
