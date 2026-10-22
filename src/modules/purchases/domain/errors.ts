import { DomainError } from '@/platform/domain/errors';

/**
 * Error de negocio de compras: su mensaje está pensado para el usuario y se muestra tal cual.
 * `httpStatus` es el status que respondía la ruta en main cuando este error llegaba al manejador genérico.
 */
export class PurchaseBusinessError extends DomainError {
  readonly code: string;
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number, code = 'PURCHASE_BUSINESS_RULE') {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class PurchaseNotFoundError extends PurchaseBusinessError {
  constructor(message: string, httpStatus: number) {
    super(message, httpStatus, 'PURCHASE_NOT_FOUND');
  }
}
