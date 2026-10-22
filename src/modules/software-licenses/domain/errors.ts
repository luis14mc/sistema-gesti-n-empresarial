import { DomainError } from '@/platform/domain/errors';

export class LicenseDomainError extends DomainError {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number, details?: unknown) {
    super(message, details);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function subscriptionNotAssignableError(reason: 'SUSPENDED' | 'EXPIRED'): LicenseDomainError {
  if (reason === 'EXPIRED') {
    return new LicenseDomainError(
      'SUBSCRIPTION_EXPIRED',
      'La licencia está vencida; renuévela antes de asignar.',
      409,
    );
  }
  return new LicenseDomainError(
    'SUBSCRIPTION_NOT_ACTIVE',
    'La licencia está suspendida o cancelada.',
    409,
  );
}

export function seatBlockedWithAssignmentsError(): LicenseDomainError {
  return new LicenseDomainError(
    'SEAT_HAS_ACTIVE_ASSIGNMENTS',
    'Libere las asignaciones del asiento antes de suspenderlo o cancelarlo.',
    409,
  );
}

export function subscriptionCancelBlockedError(): LicenseDomainError {
  return new LicenseDomainError(
    'SUBSCRIPTION_HAS_ACTIVE_ASSIGNMENTS',
    'Libere las asignaciones del asiento antes de suspenderlo o cancelarlo.',
    409,
  );
}
