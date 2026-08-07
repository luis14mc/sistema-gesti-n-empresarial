import type { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { isOrganizationContextError, requireOrganizationContext, type OrganizationContext } from '@/modules/organizations/application/context';
import { apiFailure } from '@/platform/api/response';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { createLogger } from '@/platform/observability/logger';
import { recordSecurityEventBestEffort } from '@/platform/security/audit/security-events';
import { EquipmentDisposalError } from '../application/errors';
import { InvalidDisposalTransitionError } from '../domain/errors';

export async function runDisposalRoute(
  request: AuthenticatedRequest,
  action: string,
  handler: (input: { requestId: string; context: Awaited<ReturnType<typeof requireOrganizationContext>> }) => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  let securityContext: OrganizationContext | undefined;
  try {
    const context = await requireOrganizationContext(request, requestId);
    securityContext = context;
    const log = createLogger({ requestId, organizationId: context.organizationId, userId: context.userId, module: 'equipment-disposal', action });
    log.info('request.started');
    const response = await handler({ requestId, context });
    log.info('request.completed', { duration: Math.round(performance.now() - startedAt), result: response.status });
    return response;
  } catch (error) {
    const status = error instanceof EquipmentDisposalError
      ? error.status
      : isOrganizationContextError(error)
        ? error.status
        : error instanceof PermissionDeniedError
          ? 403
          : error instanceof InvalidDisposalTransitionError
            ? 409
            : error instanceof ZodError
              ? 400
              : 500;
    const code = error instanceof EquipmentDisposalError || isOrganizationContextError(error)
      ? error.code
      : error instanceof PermissionDeniedError
        ? 'PERMISSION_DENIED'
        : error instanceof InvalidDisposalTransitionError
          ? 'INVALID_STATUS_TRANSITION'
          : error instanceof ZodError
            ? 'INVALID_DISPOSAL_DATA'
            : error instanceof Error && [
              'DISPOSAL_RENDER_FAILED', 'PDF_BROWSER_NOT_AVAILABLE', 'DISPOSAL_PDF_STORAGE_FAILED', 'EMPTY_DISPOSAL_PDF',
            ].includes(error.message)
              ? error.message
              : 'INTERNAL_ERROR';
    if (error instanceof PermissionDeniedError && securityContext) {
      await recordSecurityEventBestEffort({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: 'authorization.permission.denied',
        outcome: 'DENIED',
        severity: 'WARNING',
        reasonCode: 'MISSING_CAPABILITY',
        module: 'equipment-disposal',
        entityType: 'AuthorizationDecision',
        action,
        requestId,
        attributes: error.details && typeof error.details === 'object'
          ? error.details as Record<string, unknown>
          : undefined,
      });
    }
    createLogger({ requestId, module: 'equipment-disposal', action }).error('request.failed', {
      duration: Math.round(performance.now() - startedAt), result: status, error,
    });
    const messages: Record<string, string> = {
      DISPOSAL_NOT_FOUND: 'El dictamen solicitado no existe.',
      INVALID_DISPOSAL_DATA: 'Los datos del dictamen son inválidos.',
      INVALID_STATUS_TRANSITION: 'La transición de estado no está permitida.',
      PERMISSION_DENIED: 'No tiene permisos para realizar esta acción.',
      TENANT_ACCESS_DENIED: 'No tiene acceso a la organización seleccionada.',
      DISPOSAL_RENDER_FAILED: 'No se pudo construir el dictamen técnico.',
      PDF_BROWSER_NOT_AVAILABLE: 'El motor de generación de PDF no está disponible.',
      DISPOSAL_PDF_STORAGE_FAILED: 'No se pudo almacenar el PDF del dictamen.',
      EMPTY_DISPOSAL_PDF: 'El PDF generado está vacío.',
      INTERNAL_ERROR: 'No se pudo completar la operación.',
    };
    return apiFailure(code, messages[code] ?? 'No se pudo completar la operación.', {
      requestId,
      status,
      details: error instanceof ZodError ? error.issues : error instanceof EquipmentDisposalError ? error.details : undefined,
    });
  }
}
