import type { NextResponse } from 'next/server';
import type { AuthenticatedRequest } from '@/lib/middleware';
import { isOrganizationContextError, requireOrganizationContext, type OrganizationContext } from '@/modules/organizations/application/context';
import { apiFailure } from '@/platform/api/response';
import { domainErrorResponse } from '@/platform/api/domain-error-response';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { createLogger } from '@/platform/observability/logger';
import { recordSecurityEventBestEffort } from '@/platform/security/audit/security-events';

export async function runReportingRoute(
  request: AuthenticatedRequest,
  action: string,
  handler: (input: { requestId: string; context: OrganizationContext }) => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  let securityContext: OrganizationContext | undefined;
  try {
    const context = await requireOrganizationContext(request, requestId);
    securityContext = context;
    const response = await handler({ requestId, context });
    createLogger({ requestId, organizationId: context.organizationId, userId: context.userId, module: 'reporting', action })
      .info('request.completed', { durationMs: Math.round(performance.now() - startedAt), status: response.status });
    return response;
  } catch (error) {
    if (error instanceof PermissionDeniedError && securityContext) {
      await recordSecurityEventBestEffort({
        organizationId: securityContext.organizationId,
        userId: securityContext.userId,
        eventType: 'authorization.permission.denied',
        outcome: 'DENIED',
        severity: 'WARNING',
        reasonCode: 'MISSING_CAPABILITY',
        module: 'reporting',
        entityType: 'AuthorizationDecision',
        action,
        requestId,
        attributes: error.details && typeof error.details === 'object'
          ? error.details as Record<string, unknown>
          : undefined,
      });
    }
    const log = createLogger({ requestId, module: 'reporting', action });
    log.error('request.failed', { durationMs: Math.round(performance.now() - startedAt), error });
    if (isOrganizationContextError(error)) {
      return apiFailure(error.code, 'No se pudo resolver el contexto de la organización.', {
        requestId,
        status: error.status,
      });
    }
    return domainErrorResponse(error, requestId);
  }
}
