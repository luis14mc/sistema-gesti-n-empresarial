import { NextResponse } from 'next/server';
import { apiFailure } from '@/platform/api/response';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizationFailure } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import {
  InvalidOficioStatusError,
  InvalidOficioStatusTransitionError,
  OficioNotFoundError,
  OficiosDomainError,
} from '@/modules/oficios/domain/errors';
import { OficioNumberingError } from '@/modules/oficios/infrastructure/numbering';

export function oficiosDomainErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof OficioNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof InvalidOficioStatusError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof InvalidOficioStatusTransitionError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof OficioNumberingError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
  }
  if (error instanceof OficiosDomainError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}

export function handleOficiosApiError(
  error: unknown,
  requestId: string,
  fallbackMessage: string,
): NextResponse {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  const domain = oficiosDomainErrorResponse(error);
  if (domain) return domain;
  const organizationResponse = oficioOrganizationFailure(error, requestId);
  if (organizationResponse) return organizationResponse;
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

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
