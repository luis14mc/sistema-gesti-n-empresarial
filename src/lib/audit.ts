import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

export type AuditModule =
  | 'TICKETS'
  | 'OFICIOS'
  | 'EQUIPOS'
  | 'ASISTENCIA'
  | 'COMPRAS'
  | 'INVENTARIO'
  | 'USUARIOS'
  | 'AUDITORIA'
  | 'MANUAL';

interface CreateAuditRecordParams {
  title: string;
  description: string;
  module: AuditModule;
  category: string;
  priority?: string;
  status?: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  organizationId?: string;
  action?: string;
  metadata?: unknown;
  requestId?: string;
  previousData?: unknown;
  newData?: unknown;
  tx?: Prisma.TransactionClient;
}

export async function createAuditRecord({
  title,
  description,
  module,
  category,
  priority = 'BAJA',
  status = 'COMPLETADO',
  userId,
  entityId,
  entityType,
  organizationId,
  action,
  metadata,
  requestId,
  previousData,
  newData,
  tx,
}: CreateAuditRecordParams) {
  try {
    const resolvedOrganizationId = organizationId ?? (await prisma.organizationMembership.findFirst({
      where: { userId, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    }))?.organizationId;
    if (!resolvedOrganizationId) throw new Error('No active organization is available for the audit record');

    return await (tx ?? prisma).auditRecord.create({
      data: {
        title,
        description,
        module,
        category,
        priority,
        status,
        userId,
        entityId,
        entityType,
        organizationId: resolvedOrganizationId,
        action,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        requestId,
        previousData: previousData ? JSON.parse(JSON.stringify(previousData)) : undefined,
        newData: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
      },
    });
  } catch (error) {
    console.error('CRITICAL: Failed to create audit record:', error);
    // Lanzar el error asegura la integridad transaccional (ISO 27001)
    throw new Error('No se pudo crear el registro de auditoría. Operación abortada.');
  }
}

export async function logChange(
  userId: string | undefined,
  module: AuditModule,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityId: string,
  newData?: unknown,
  oldData?: unknown
) {
  return createAuditRecord({
    title: `${action} en ${module}`,
    description: `Operación ${action} realizada sobre entidad ${entityId}`,
    module,
    category: action,
    userId,
    entityId,
    previousData: oldData,
    newData,
  });
}
