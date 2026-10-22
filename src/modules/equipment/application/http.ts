import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { apiFailure } from '@/platform/api/response';
import { authorizationFailure } from '@/platform/security/authorization/http';
import { DomainError } from '@/platform/domain/errors';

export function equipmentApiFailure(
  error: unknown,
  requestId: string,
  fallback: { code: string; message: string; stage: string },
) {
  const denied = authorizationFailure(error, requestId);
  if (denied) return denied;
  if (error instanceof DomainError) {
    return apiFailure(error.code, error.message, {
      requestId,
      status: error.httpStatus,
      details: error.details ?? [],
      stage: fallback.stage,
    });
  }
  if (isOrganizationContextError(error)) {
    return apiFailure(error.code, 'No fue posible resolver el contexto de organización.', {
      requestId,
      status: error.status,
      details: [],
      stage: 'RESOLVE_ORGANIZATION_CONTEXT',
    });
  }
  return apiFailure(fallback.code, fallback.message, {
    requestId,
    status: 500,
    details: [],
    stage: fallback.stage,
  });
}
