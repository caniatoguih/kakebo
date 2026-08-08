import { Prisma } from '@prisma/client';
import { getRequestContext } from '../observability/requestContext';

export interface AuditEvent {
  usuarioId: string;
  action: string;
  entity: string;
  entityId?: string;
  data?: Prisma.InputJsonValue;
}

export async function recordFinancialAudit(tx: Prisma.TransactionClient, event: AuditEvent): Promise<void> {
  await tx.auditoriaFinanceira.create({
    data: {
      usuario_id: event.usuarioId,
      request_id: getRequestContext()?.requestId,
      acao: event.action,
      entidade: event.entity,
      entidade_id: event.entityId,
      dados: event.data,
    },
  });
}
