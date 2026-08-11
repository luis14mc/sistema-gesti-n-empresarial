import { ZodError } from 'zod';
import type { NextResponse } from 'next/server';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { apiFailure } from '@/platform/api/response';
import { createLogger } from '@/platform/observability/logger';
import { recordSecurityEventBestEffort } from '@/platform/security/audit/security-events';
import { isOrganizationContextError, requireOrganizationContext, type OrganizationContext } from '@/modules/organizations/application/context';
import { requirePermission } from '@/platform/security/authorization/permissions';
import { isIntegrationDomainError } from '@/platform/integrations/domain/integration-errors';
import { FEATURES } from '@/platform/config/features';

export async function runIntegrationRoute(
  request: AuthenticatedRequest,
  action: string,
  permission: Parameters<typeof requirePermission>[1],
  handler: (input: { requestId: string; context: OrganizationContext }) => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  // Phase 14C — the generic integration framework is foundation-only (no active
  // CNI integration/adapter). Disabled at runtime unless explicitly enabled.
  if (!FEATURES.integrations) {
    return apiFailure('FEATURE_NOT_AVAILABLE', 'Recurso no disponible.', { requestId, status: 404 });
  }
  const startedAt = performance.now();
  let securityContext: OrganizationContext | undefined;
  try {
    const context = await requireOrganizationContext(request, requestId);
    securityContext = context;
    requirePermission(context, permission);
    const log = createLogger({
      requestId,
      organizationId: context.organizationId,
      userId: context.userId,
      module: 'integrations',
      action,
    });
    log.info('integration.request.started');
    const response = await handler({ requestId, context });
    log.info('integration.request.completed', {
      duration: Math.round(performance.now() - startedAt),
      result: response.status,
    });
    return response;
  } catch (error) {
    const status = error instanceof ZodError
      ? 400
      : isOrganizationContextError(error)
        ? error.status
        : isIntegrationDomainError(error)
          ? (error as { status?: number }).status ?? 500
          : 500;
    const code = error instanceof ZodError
      ? 'INVALID_INTEGRATION_DATA'
      : isOrganizationContextError(error)
        ? error.code
        : isIntegrationDomainError(error)
          ? (error as { code?: string }).code ?? 'INTEGRATION_ERROR'
          : 'INTERNAL_ERROR';
    if (securityContext) {
      await recordSecurityEventBestEffort({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: 'integration.request.failed',
        outcome: 'DENIED',
        severity: 'WARNING',
        reasonCode: code,
        module: 'integrations',
        entityType: 'OrganizationIntegration',
        action,
        requestId,
        attributes: error instanceof ZodError
          ? { issues: error.issues.slice(0, 5) }
          : isIntegrationDomainError(error)
            ? (error as { details?: unknown }).details as Record<string, unknown>
            : undefined,
      });
    }
    createLogger({ requestId, module: 'integrations', action }).error('integration.request.failed', {
      duration: Math.round(performance.now() - startedAt),
      result: status,
      error,
    });
    const messages: Record<string, string> = {
      INTEGRATION_NOT_FOUND: 'La integración solicitada no existe en esta organización.',
      INTEGRATION_NOT_ENABLED: 'La integración no está habilitada.',
      INTEGRATION_CONFIGURATION_INVALID: 'La configuración de la integración no es válida.',
      INTEGRATION_PERMISSION_DENIED: 'No tiene permisos para administrar integraciones.',
      INTEGRATION_CREDENTIAL_EXPIRED: 'Las credenciales de la integración han expirado.',
      INTEGRATION_SECRET_REFERENCE_INVALID: 'La referencia al secreto no es válida.',
      INTEGRATION_CONNECTION_FAILED: 'No se pudo establecer la conexión con el proveedor.',
      INTEGRATION_TIMEOUT: 'La operación contra el proveedor excedió el tiempo máximo.',
      INTEGRATION_RATE_LIMITED: 'El proveedor está limitando las solicitudes. Intente más tarde.',
      INTEGRATION_CIRCUIT_OPEN: 'El circuito de la integración está abierto. Intente más tarde.',
      INVALID_INTEGRATION_DATA: 'Los datos de la integración no son válidos.',
      AUTHENTICATION_REQUIRED: 'Debe iniciar sesión para continuar.',
      ORGANIZATION_MEMBERSHIP_REQUIRED: 'El usuario no pertenece a una organización activa.',
      ORGANIZATION_SELECTION_REQUIRED: 'Seleccione la organización con la que desea trabajar.',
      TENANT_ACCESS_DENIED: 'No tiene acceso a la organización seleccionada.',
      PERMISSION_DENIED: 'No tiene permisos para administrar integraciones.',
      INTERNAL_ERROR: 'No se pudo completar la operación de integraciones.',
    };
    return apiFailure(code, messages[code] ?? 'No se pudo completar la operación de integraciones.', {
      requestId,
      status,
      details: error instanceof ZodError
        ? error.issues
        : isIntegrationDomainError(error)
          ? (error as { details?: unknown }).details
          : undefined,
    });
  }
}
