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

const RECOVERABLE_STATUSES: EquipmentStatus[] = ['DAMAGED', 'LOST'];

export function assertManualEquipmentStatusUpdate(input: {
  requested: unknown;
  current: EquipmentStatus;
  hasActiveAssignment: boolean;
  hasOpenMaintenance: boolean;
}): EquipmentStatus | undefined {
  if (input.requested === undefined) return undefined;

  const requested = String(input.requested) as EquipmentStatus;
  if (requested === input.current) return undefined;

  if (requested === 'RETIRED' || requested === 'DISPOSED') {
    throw new DomainConflictError('Use el flujo de dictamen técnico para dar de baja el equipo.');
  }

  if (requested === 'ASSIGNED') {
    throw new EquipmentFlowStatusError();
  }

  if (requested === 'AVAILABLE') {
    if (!RECOVERABLE_STATUSES.includes(input.current)) {
      throw new EquipmentFlowStatusError();
    }
    if (input.hasActiveAssignment) {
      throw new DomainConflictError('Devuelva el equipo antes de marcarlo como disponible.');
    }
    if (input.hasOpenMaintenance) {
      throw new DomainConflictError('Complete o cancele el mantenimiento abierto.');
    }
    return 'AVAILABLE';
  }

  if (!MANUAL_ALLOWED.includes(requested)) {
    throw new InvalidDomainDataError('Este estado solo puede cambiarse desde su flujo operativo.');
  }

  if (input.hasActiveAssignment) {
    throw new DomainConflictError('Devuelva el equipo antes de marcarlo como dañado o perdido.');
  }

  return requested;
}
