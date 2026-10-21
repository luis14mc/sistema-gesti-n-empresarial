import { OficioNotFoundError } from '@/modules/oficios/domain/errors';
import { findOficioByIdDetailed } from '@/modules/oficios/infrastructure/oficio-repository';

export async function getOficioUseCase(params: {
  organizationId: string;
  actorRole: string;
  actorUserId: string;
  actorEmail: string;
  oficioId: string;
}) {
  const oficio = await findOficioByIdDetailed(params.organizationId, params.oficioId);

  if (!oficio) {
    throw new OficioNotFoundError();
  }

  if (params.actorRole === 'USER') {
    const isCreator = oficio.createdById === params.actorUserId;
    const isRecipient =
      !!oficio.recipient &&
      oficio.recipient.toLowerCase().includes(params.actorEmail.toLowerCase());
    if (!isCreator && !isRecipient) {
      throw new OficioNotFoundError();
    }
  }

  return { oficio };
}
