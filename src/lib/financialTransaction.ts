import type { Prisma } from '@prisma/client';
import prisma from './prisma';

// Reexecuta a leitura e a escrita juntas quando houver conflito com outra operação.
export async function financialTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Error) || !('code' in error) || error.code !== 'P2034') {
        throw error;
      }
    }
  }
}
