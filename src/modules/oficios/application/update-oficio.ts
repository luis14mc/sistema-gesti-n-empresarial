import { createAuditRecord } from '@/lib/audit';
import { OficioNotFoundError } from '@/modules/oficios/domain/errors';
import {
  findOficioById,
  updateOficioById,
} from '@/modules/oficios/infrastructure/oficio-repository';

export async function updateOficioUseCase(params: {
  organizationId: string;
  actorUserId: string;
  actorRole: string;
  oficioId: string;
  body: Record<string, unknown>;
}) {
  const currentOficio = await findOficioById(params.organizationId, params.oficioId);

  if (!currentOficio) {
    throw new OficioNotFoundError();
  }

  if (params.actorRole === 'USER' && currentOficio.createdById !== params.actorUserId) {
    throw new OficioNotFoundError();
  }

  const allowedFields = [
    'subject',
    'recipient',
    'institution',
    'preparedBy',
    'status',
    'attachments',
    'oficioDate',
    'receivedDate',
    'sentDate',
    'comments',
    'senderName',
    'senderPosition',
    'recipientName',
    'recipientPosition',
    'cc',
    'responseToId',
    'signerId',
    'responsibleEmployeeId',
    'documentKind',
  ];

  const updateData: Record<string, unknown> = { updatedById: params.actorUserId };
  allowedFields.forEach((field) => {
    if (params.body[field] !== undefined) {
      if (['oficioDate', 'receivedDate', 'sentDate'].includes(field) && params.body[field]) {
        updateData[field] = new Date(String(params.body[field]));
      } else {
        updateData[field] = params.body[field];
      }
    }
  });

  if (params.body.status === 'SENT' && !updateData.sentDate) {
    updateData.sentDate = new Date();
  }

  const oficio = await updateOficioById({
    organizationId: params.organizationId,
    id: params.oficioId,
    data: updateData,
  });

  await createAuditRecord({
    title: 'Actualización de oficio',
    description: `Se actualizó oficio: ${oficio.number} - ${oficio.subject}`,
    module: 'OFICIOS',
    category: 'UPDATE',
    userId: params.actorUserId,
    entityId: oficio.id,
    organizationId: params.organizationId,
    previousData: { status: currentOficio.status, subject: currentOficio.subject },
    newData: { status: oficio.status, subject: oficio.subject },
  });

  return { oficio };
}
