import { createAuditRecord } from '@/lib/audit';
import { OficioNotFoundError } from '@/modules/oficios/domain/errors';
import {
  archiveOficio,
  findOficioById,
} from '@/modules/oficios/infrastructure/oficio-repository';

export async function deleteOficioUseCase(params: {
  organizationId: string;
  actorUserId: string;
  actorRole: string;
  oficioId: string;
}) {
  const current = await findOficioById(params.organizationId, params.oficioId);
  if (!current) {
    throw new OficioNotFoundError();
  }

  if (params.actorRole === 'USER' && current.createdById !== params.actorUserId) {
    throw new OficioNotFoundError();
  }

  await archiveOficio(params.organizationId, params.oficioId);

  await createAuditRecord({
    title: 'Desactivación de oficio',
    description: `Se desactivó oficio: ${current.number} - ${current.subject}`,
    module: 'OFICIOS',
    category: 'DELETE',
    userId: params.actorUserId,
    entityId: params.oficioId,
    organizationId: params.organizationId,
    previousData: { number: current.number, subject: current.subject, status: current.status },
    newData: { status: 'ARCHIVED' },
  });

  return { message: 'Oficio desactivado' };
}
