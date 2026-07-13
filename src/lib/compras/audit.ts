import { createAuditRecord } from '@/lib/audit';
import type { CompraEstado } from '@prisma/client';

export async function logCompraAudit(params: {
  userId?: string;
  solicitudId: string;
  documentoId?: string;
  action: string;
  estadoAnterior?: CompraEstado;
  estadoNuevo?: CompraEstado;
  detalles?: string;
  previousData?: unknown;
  newData?: unknown;
}) {
  const description =
    params.detalles ??
    `Solicitud ${params.solicitudId}${params.documentoId ? ` · documento ${params.documentoId}` : ''}: ${params.estadoAnterior ?? '—'} → ${params.estadoNuevo ?? '—'}`;

  return createAuditRecord({
    title: `Compra: ${params.action}`,
    description,
    module: 'COMPRAS',
    category: params.action,
    userId: params.userId,
    entityId: params.solicitudId,
    previousData: params.previousData,
    newData: params.newData,
  });
}
