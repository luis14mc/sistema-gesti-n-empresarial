import { createAuditRecord } from '@/platform/security/audit/audit-record';
import type { OficioStatus } from '@/types';
import {
  InvalidOficioStatusError,
  InvalidOficioStatusTransitionError,
  OficioNotFoundError,
} from '@/modules/oficios/domain/errors';
import { isValidOficioStatusTransition } from '@/modules/oficios/domain/oficios-status-transitions';
import {
  changeOficioStatus,
  findOficioStatusContext,
} from '@/modules/oficios/infrastructure/oficio-repository';

const ALLOWED: OficioStatus[] = [
  'DRAFT',
  'SENT',
  'RECEIVED',
  'IN_PROCESS',
  'COMPLETED',
  'ARCHIVED',
  'ASSIGNED',
  'PENDING_SIGNATURE',
  'SIGNED',
  'ACKNOWLEDGED',
  'RESPONDED',
];

export async function changeOficioStatusUseCase(params: {
  organizationId: string;
  actorUserId: string;
  actorRole: string;
  oficioId: string;
  nextStatus: unknown;
}) {
  const next = params.nextStatus as OficioStatus | undefined;
  if (!next || !ALLOWED.includes(next)) {
    throw new InvalidOficioStatusError();
  }

  const current = await findOficioStatusContext(params.organizationId, params.oficioId);
  if (!current) {
    throw new OficioNotFoundError();
  }

  if (params.actorRole === 'USER' && current.createdById !== params.actorUserId) {
    throw new OficioNotFoundError();
  }

  if (!isValidOficioStatusTransition(current.status as OficioStatus, next)) {
    throw new InvalidOficioStatusTransitionError(String(current.status), next);
  }

  const updated = await changeOficioStatus({
    organizationId: params.organizationId,
    oficioId: params.oficioId,
    actorUserId: params.actorUserId,
    nextStatus: next,
    currentStatus: String(current.status),
  });

  await createAuditRecord({
    title: 'Cambio de estado de oficio',
    description: `Oficio ${current.number}: ${current.status} → ${next}`,
    module: 'OFICIOS',
    category: 'UPDATE',
    userId: params.actorUserId,
    entityId: params.oficioId,
    organizationId: params.organizationId,
    previousData: { status: current.status },
    newData: { status: next },
  });

  return { oficio: updated };
}
