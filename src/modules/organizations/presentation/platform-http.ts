import { ZodError } from 'zod';
import type { NextResponse } from 'next/server';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { apiFailure } from '@/platform/api/response';
import { createLogger } from '@/platform/observability/logger';
import { recordSecurityEventBestEffort } from '@/platform/security/audit/security-events';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { isPlatformContextError, requirePlatformContext, type PlatformContext } from '@/modules/organizations/application/platform-context';
import { isOrganizationDomainError } from '@/modules/organizations/domain/errors';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { InvalidOrganizationCommandError } from '@/modules/organizations/application/lifecycle';
import { FEATURES } from '@/platform/config/features';

export type PlatformRouteAction = string;

export async function runPlatformRoute(
  request: AuthenticatedRequest,
  action: PlatformRouteAction,
  handler: (input: { requestId: string; context: PlatformContext }) => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  // Phase 14B/14C — platform administration is a foundation-only capability and
  // is disabled for the internal CNI deployment. Behaves as if the route does
  // not exist unless explicitly enabled.
  if (!FEATURES.platformAdmin) {
    return apiFailure('FEATURE_NOT_AVAILABLE', 'Recurso no disponible.', { requestId, status: 404 });
  }
  const startedAt = performance.now();
  let platformContext: PlatformContext | undefined;
  try {
    const context = await requirePlatformContext(request, requestId);
    platformContext = context;
    const log = createLogger({
      requestId,
      userId: context.userId,
      module: 'platform',
      action,
    });
    log.info('platform.request.started');
    const response = await handler({ requestId, context });
    log.info('platform.request.completed', { duration: Math.round(performance.now() - startedAt), result: response.status });
    return response;
  } catch (error) {
    const typedError = error as { status?: number; code?: string; details?: unknown; name?: string };
    const status = error instanceof PermissionDeniedError
      ? 403
      : error instanceof ZodError
        ? 400
        : isPlatformContextError(error)
          ? error.status
          : isOrganizationContextError(error)
            ? error.status
            : isOrganizationDomainError(error)
              ? typeof typedError.status === 'number'
                ? typedError.status
                : 500
              : 500;
    const code = error instanceof PermissionDeniedError
      ? 'PERMISSION_DENIED'
      : error instanceof ZodError
        ? 'INVALID_PLATFORM_DATA'
        : isPlatformContextError(error)
          ? error.code
          : isOrganizationContextError(error)
            ? error.code
            : isOrganizationDomainError(error)
              ? typedError.code ?? 'INVALID_ORGANIZATION_TRANSITION'
              : error instanceof InvalidOrganizationCommandError
                ? error.code
                : 'INTERNAL_ERROR';

    if (error instanceof PermissionDeniedError && platformContext) {
      await recordSecurityEventBestEffort({
        userId: platformContext.userId,
        eventType: 'authorization.permission.denied',
        outcome: 'DENIED',
        severity: 'WARNING',
        reasonCode: 'MISSING_CAPABILITY',
        module: 'platform',
        entityType: 'AuthorizationDecision',
        action,
        requestId,
        attributes: error.details && typeof error.details === 'object'
          ? error.details as Record<string, unknown>
          : undefined,
      });
    }

    createLogger({ requestId, module: 'platform', action }).error('platform.request.failed', {
      duration: Math.round(performance.now() - startedAt),
      result: status,
      error,
    });
    const messages: Record<string, string> = {
      ORGANIZATION_NOT_FOUND: 'La organización solicitada no existe.',
      INVALID_ORGANIZATION_TRANSITION: 'La transición de estado de la organización no está permitida.',
      LAST_OWNER_REQUIRED: 'La organización debe conservar al menos un propietario activo.',
      ONBOARDING_INCOMPLETE: 'La organización no puede activarse hasta completar el proceso de alta.',
      PLATFORM_PERMISSION_REQUIRED: 'No tiene permisos de plataforma para realizar esta acción.',
      AUTHENTICATION_REQUIRED: 'Debe iniciar sesión para continuar.',
      PERMISSION_DENIED: 'No tiene permisos para realizar esta acción.',
      INVALID_PLATFORM_DATA: 'Los datos proporcionados no son válidos.',
      INVALID_ORGANIZATION_COMMAND: 'La solicitud sobre la organización no es válida.',
      INTERNAL_ERROR: 'No se pudo completar la operación de plataforma.',
    };
    const details = error instanceof ZodError
      ? error.issues
      : (error instanceof PermissionDeniedError || isOrganizationDomainError(error) || isPlatformContextError(error))
        ? typedError.details
        : undefined;
    return apiFailure(code, messages[code] ?? 'No se pudo completar la operación de plataforma.', {
      requestId,
      status,
      details,
    });
  }
}
