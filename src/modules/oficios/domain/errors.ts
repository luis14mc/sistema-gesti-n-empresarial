export class OficiosDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'OficiosDomainError';
  }
}

export class OficioNotFoundError extends OficiosDomainError {
  constructor() {
    super('Oficio no encontrado', 'OFICIO_NOT_FOUND');
  }
}

export class InvalidOficioStatusError extends OficiosDomainError {
  constructor() {
    super('Estado no válido', 'INVALID_OFICIO_STATUS');
  }
}

export class InvalidOficioStatusTransitionError extends OficiosDomainError {
  constructor(from: string, to: string) {
    super(`Transición no permitida: ${from} → ${to}`, 'INVALID_STATUS_TRANSITION');
  }
}

/** Validación de entrada con mensaje explícito para el cliente HTTP. */
export class OficioBadRequestError extends OficiosDomainError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(message, code);
  }
}

/** Respuesta HTTP con cuerpo JSON arbitrario (409 duplicados, etc.). */
export class OficioRequestError extends OficiosDomainError {
  constructor(
    code: string,
    message: string,
    readonly httpStatus: number,
    readonly body: Record<string, unknown>,
  ) {
    super(message, code);
  }
}

export class ImportBatchNotFoundError extends OficiosDomainError {
  constructor() {
    super('Batch no encontrado', 'BATCH_NOT_FOUND');
  }
}

export class ImportBatchDocumentsNotFoundError extends OficiosDomainError {
  constructor() {
    super('Lote no encontrado.', 'BATCH_NOT_FOUND');
  }
}
