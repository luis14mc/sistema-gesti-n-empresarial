export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  protected constructor(message: string, readonly details?: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class EntityNotFoundError extends DomainError {
  readonly code = 'ENTITY_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'El recurso solicitado no existe.', details?: unknown) { super(message, details); }
}

export class InvalidDomainDataError extends DomainError {
  readonly code = 'INVALID_DOMAIN_DATA';
  readonly httpStatus = 422;
  constructor(message = 'Los datos no cumplen las reglas del negocio.', details?: unknown) { super(message, details); }
}

export class InvalidStatusTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION';
  readonly httpStatus = 409;
  constructor(from: string, to: string, details?: unknown) {
    super(`No se permite cambiar el estado de ${from} a ${to}.`, details ?? { from, to });
  }
}

export class DomainConflictError extends DomainError {
  readonly code = 'DOMAIN_CONFLICT';
  readonly httpStatus = 409;
  constructor(message = 'La operación entra en conflicto con el estado actual.', details?: unknown) { super(message, details); }
}

export class AlreadyProcessedError extends DomainError {
  readonly code = 'ALREADY_PROCESSED';
  readonly httpStatus = 409;
  constructor(message = 'La operación ya fue procesada.', details?: unknown) { super(message, details); }
}

export class PermissionDeniedError extends DomainError {
  readonly code = 'PERMISSION_DENIED';
  readonly httpStatus = 403;
  constructor(message = 'No tiene permiso para realizar esta operación.', details?: unknown) { super(message, details); }
}

export class ConcurrentModificationError extends DomainError {
  readonly code = 'CONCURRENT_MODIFICATION';
  readonly httpStatus = 409;
  constructor(details?: unknown) {
    super('Este registro fue actualizado por otro usuario. Recargue la información antes de continuar.', details);
  }
}

export class SequenceAllocationFailedError extends DomainError {
  readonly code = 'SEQUENCE_ALLOCATION_FAILED';
  readonly httpStatus = 500;
  constructor(details?: unknown, options?: ErrorOptions) { super('No se pudo asignar el número institucional.', details, options); }
}

export class DocumentGenerationFailedError extends DomainError {
  readonly code = 'DOCUMENT_GENERATION_FAILED';
  readonly httpStatus = 500;
  constructor(message = 'No se pudo generar el documento.', details?: unknown, options?: ErrorOptions) { super(message, details, options); }
}

export class StorageFailedError extends DomainError {
  readonly code = 'STORAGE_FAILED';
  readonly httpStatus = 500;
  constructor(message = 'No se pudo almacenar el documento.', details?: unknown, options?: ErrorOptions) { super(message, details, options); }
}

export class ExternalIntegrationFailedError extends DomainError {
  readonly code = 'EXTERNAL_INTEGRATION_FAILED';
  readonly httpStatus = 502;
  constructor(message = 'Un servicio externo no pudo completar la operación.', details?: unknown, options?: ErrorOptions) { super(message, details, options); }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
