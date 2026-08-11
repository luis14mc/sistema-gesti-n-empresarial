import { DomainError } from '@/platform/domain/errors';

export class ReportNotFoundError extends DomainError {
  readonly code = 'REPORT_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(reportCode: string) {
    super('El reporte solicitado no existe.', { reportCode });
  }
}

export class InvalidReportFiltersError extends DomainError {
  readonly code = 'INVALID_REPORT_FILTERS';
  readonly httpStatus = 400;
  constructor(details?: unknown) {
    super('Los filtros del reporte no son válidos.', details);
  }
}

export class ReportRowLimitExceededError extends DomainError {
  readonly code = 'REPORT_ROW_LIMIT_EXCEEDED';
  readonly httpStatus = 413;
  constructor(limit: number) {
    super('El reporte supera el límite de filas permitido.', { limit });
  }
}

export class ReportGenerationFailedError extends DomainError {
  readonly code = 'REPORT_GENERATION_FAILED';
  readonly httpStatus = 500;
  constructor(details?: unknown, options?: ErrorOptions) {
    super('No se pudo generar el reporte.', details, options);
  }
}
