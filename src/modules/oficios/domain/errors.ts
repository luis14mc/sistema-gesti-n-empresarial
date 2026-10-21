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
