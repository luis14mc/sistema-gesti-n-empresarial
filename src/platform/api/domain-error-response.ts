import { apiFailure } from './response';
import { isDomainError } from '@/platform/domain/errors';

export function domainErrorResponse(error: unknown, requestId: string) {
  if (isDomainError(error)) {
    return apiFailure(error.code, error.message, {
      requestId,
      status: error.httpStatus,
      details: error.details,
    });
  }

  return apiFailure('INTERNAL_ERROR', 'No se pudo completar la operación.', {
    requestId,
    status: 500,
  });
}
