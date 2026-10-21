import { NextResponse } from 'next/server';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizationFailure } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import {
  ImportBatchDocumentsNotFoundError,
  ImportBatchNotFoundError,
  InvalidOficioStatusError,
  InvalidOficioStatusTransitionError,
  OficioBadRequestError,
  OficioNotFoundError,
  OficioRequestError,
  OficiosDomainError,
} from '@/modules/oficios/domain/errors';
import { OficioNumberingError } from '@/modules/oficios/infrastructure/numbering';

export function oficiosDomainErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof OficioRequestError) {
    return NextResponse.json(error.body, { status: error.httpStatus });
  }
  if (error instanceof OficioBadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ImportBatchNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ImportBatchDocumentsNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
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
  if (error instanceof Error && error.message.includes('Formato no permitido')) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export function handleImportBatchDocumentsApiError(
  error: unknown,
  requestId: string,
): ReturnType<typeof apiFailure> | ReturnType<typeof apiSuccess> {
  const denied = authorizationFailure(error, requestId);
  if (denied) return denied;
  if (error instanceof ImportBatchDocumentsNotFoundError) {
    return apiFailure('BATCH_NOT_FOUND', 'Lote no encontrado.', {
      requestId,
      status: 404,
      details: [],
      stage: 'LOAD_BATCH',
    });
  }
  console.error('[OFICIOS BATCH DOCUMENTS ERROR]', { requestId, error });
  return apiFailure('BATCH_DOCUMENTS_FAILED', 'No se pudieron asociar los PDFs.', {
    requestId,
    status: 500,
    details: [],
    stage: 'BATCH_DOCUMENTS',
  });
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
