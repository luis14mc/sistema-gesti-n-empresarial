import { apiFailure } from '@/platform/api/response';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizationFailure } from '@/platform/security/authorization/http';

export function oficioOrganizationFailure(error: unknown, requestId: string) {
  const denied = authorizationFailure(error, requestId);
  if (denied) return denied;
  if (!isOrganizationContextError(error)) return null;
  const message = error.code === 'ORGANIZATION_SELECTION_REQUIRED'
    ? 'Seleccione la organización con la que desea trabajar.'
    : error.code === 'AUTHENTICATION_REQUIRED'
      ? 'Debe iniciar sesión para continuar.'
      : 'No existe una organización activa para este usuario.';
  return apiFailure(error.code, message, {
    requestId,
    status: error.status,
    details: [],
    stage: 'RESOLVE_ORGANIZATION_CONTEXT',
  });
}
