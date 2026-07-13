import { prisma } from './prisma';

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
  previousData?: unknown;
  newData?: unknown;
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
  previousData,
  newData,
}: CreateAuditRecordParams) {
  try {
    return await prisma.auditRecord.create({
      data: {
        title,
        description,
        module,
        category,
        priority,
        status,
        userId,
        entityId,
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
