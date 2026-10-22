import type { EquipmentStatus } from '@prisma/client';
import { DomainError, InvalidDomainDataError, DomainConflictError } from '@/platform/domain/errors';

export class EquipmentFlowStatusError extends DomainError {
  readonly code = 'EQUIPMENT_STATUS_FLOW_ONLY';
  readonly httpStatus = 400;

  constructor() {
    super('El estado cambia al asignar o devolver el equipo.');
  }
}

const MANUAL_ALLOWED: EquipmentStatus[] = ['DAMAGED', 'LOST'];

const FLOW_ONLY_STATUSES: EquipmentStatus[] = ['ASSIGNED', 'AVAILABLE'];

export function assertManualEquipmentStatusUpdate(input: {
  requested: unknown;
  current: EquipmentStatus;
  hasActiveAssignment: boolean;
}): EquipmentStatus | undefined {
  if (input.requested === undefined) return undefined;

  const requested = String(input.requested) as EquipmentStatus;
  if (requested === input.current) return undefined;

  if (requested === 'RETIRED' || requested === 'DISPOSED') {
    throw new DomainConflictError('Use el flujo de dictamen técnico para dar de baja el equipo.');
  }

  if (FLOW_ONLY_STATUSES.includes(requested)) {
    throw new EquipmentFlowStatusError();
  }

  if (!MANUAL_ALLOWED.includes(requested)) {
    throw new InvalidDomainDataError('Este estado solo puede cambiarse desde su flujo operativo.');
  }

  if (input.hasActiveAssignment) {
    throw new DomainConflictError('Devuelva el equipo antes de marcarlo como dañado o perdido.');
  }

  return requested;
}
