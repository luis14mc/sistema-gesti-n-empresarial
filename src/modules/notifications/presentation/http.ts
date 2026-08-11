import { ZodError } from 'zod';
import type { NextResponse } from 'next/server';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { apiFailure } from '@/platform/api/response';
import { createLogger } from '@/platform/observability/logger';
import { recordSecurityEventBestEffort } from '@/platform/security/audit/security-events';
import { isOrganizationContextError, requireOrganizationContext, type OrganizationContext } from '@/modules/organizations/application/context';
import { requirePermission } from '@/platform/security/authorization/permissions';
import { isNotificationDomainError } from '@/modules/notifications/domain/errors';
import { FEATURES } from '@/platform/config/features';

export async function runNotificationRoute(
  request: AuthenticatedRequest,
  action: string,
  handler: (input: { requestId: string; context: OrganizationContext }) => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  // Phase 14D — notifications are foundation-only for the initial release (no
  // in-app center / email backend). Disabled at runtime unless explicitly enabled.
  if (!FEATURES.notifications) {
    return apiFailure('FEATURE_NOT_AVAILABLE', 'Recurso no disponible.', { requestId, status: 404 });
  }
  const startedAt = performance.now();
  let securityContext: OrganizationContext | undefined;
  try {
    const context = await requireOrganizationContext(request, requestId);
    securityContext = context;
    requirePermission(context, 'notifications.read');
    const log = createLogger({
      requestId,
      organizationId: context.organizationId,
      userId: context.userId,
      module: 'notifications',
      action,
    });
    log.info('notification.request.started');
    const response = await handler({ requestId, context });
    log.info('notification.request.completed', {
      duration: Math.round(performance.now() - startedAt),
      result: response.status,
    });
    return response;
  } catch (error) {
    const status = error instanceof ZodError
      ? 400
      : isOrganizationContextError(error)
        ? error.status
        : isNotificationDomainError(error)
          ? (error as { status?: number }).status ?? 500
          : 500;
    const code = error instanceof ZodError
      ? 'INVALID_NOTIFICATION_DATA'
      : isOrganizationContextError(error)
        ? error.code
        : isNotificationDomainError(error)
          ? (error as { code?: string }).code ?? 'NOTIFICATION_ERROR'
          : 'INTERNAL_ERROR';
    if (securityContext) {
      await recordSecurityEventBestEffort({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: 'notification.request.failed',
        outcome: 'DENIED',
        severity: 'WARNING',
        reasonCode: code,
        module: 'notifications',
        entityType: 'Notification',
        action,
        requestId,
        attributes: error instanceof ZodError
          ? { issues: error.issues.slice(0, 5) }
          : isNotificationDomainError(error)
            ? (error as { details?: unknown }).details as Record<string, unknown>
            : undefined,
      });
    }
    createLogger({ requestId, module: 'notifications', action }).error('notification.request.failed', {
      duration: Math.round(performance.now() - startedAt),
      result: status,
      error,
    });
    const messages: Record<string, string> = {
      NOTIFICATION_NOT_FOUND: 'La notificación solicitada no existe.',
      NOTIFICATION_OWNERSHIP_DENIED: 'No puede operar sobre notificaciones de otro usuario.',
      INVALID_NOTIFICATION_ACTION_URL: 'La URL de la notificación no es una ruta interna válida.',
      INVALID_NOTIFICATION_DATA: 'Los datos de la notificación no son válidos.',
      AUTHENTICATION_REQUIRED: 'Debe iniciar sesión para continuar.',
      ORGANIZATION_MEMBERSHIP_REQUIRED: 'El usuario no pertenece a una organización activa.',
      ORGANIZATION_SELECTION_REQUIRED: 'Seleccione la organización con la que desea trabajar.',
      TENANT_ACCESS_DENIED: 'No tiene acceso a la organización seleccionada.',
      PERMISSION_DENIED: 'No tiene permisos para acceder a las notificaciones.',
      INTERNAL_ERROR: 'No se pudo completar la operación de notificaciones.',
    };
    return apiFailure(code, messages[code] ?? 'No se pudo completar la operación de notificaciones.', {
      requestId,
      status,
      details: error instanceof ZodError
        ? error.issues
        : isNotificationDomainError(error)
          ? (error as { details?: unknown }).details
          : undefined,
    });
  }
}
