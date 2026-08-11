import { apiFailure } from '@/platform/api/response';
import { isOrganizationContextError } from '@/modules/organizations/application/context';

export function oficioOrganizationFailure(error: unknown, requestId: string) {
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
