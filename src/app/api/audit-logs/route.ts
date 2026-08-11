import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { isOrganizationContextError, requireOrganizationContext, type OrganizationContext } from '@/modules/organizations/application/context';
import { domainErrorResponse } from '@/platform/api/domain-error-response';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { auditLogQueryService } from '@/platform/security/audit/audit-log-query-service';
import { recordSecurityEventBestEffort } from '@/platform/security/audit/security-events';

async function getHandler(req: AuthenticatedRequest) {
    const requestId = crypto.randomUUID();
    let securityContext: OrganizationContext | undefined;
    try {
        const organization = await requireOrganizationContext(req, requestId);
        securityContext = organization;
        const { searchParams } = new URL(req.url);
        const result = await auditLogQueryService.list(organization, {
            userId: searchParams.get('userId') || undefined,
            module: searchParams.get('module') || undefined,
            action: searchParams.get('action') || searchParams.get('category') || undefined,
            page: Number(searchParams.get('page') || 1),
            pageSize: Number(searchParams.get('pageSize') || 20),
        });
        await recordSecurityEventBestEffort({
            organizationId: organization.organizationId,
            userId: organization.userId,
            eventType: 'audit.events.read',
            outcome: 'SUCCESS',
            severity: 'NOTICE',
            module: 'security-audit',
            entityType: 'AuditLog',
            action: 'READ',
            requestId,
            attributes: { page: result.page, pageSize: result.pageSize },
        });
        return NextResponse.json(result, { headers: { 'x-request-id': requestId } });
    } catch (error) {
        if (error instanceof PermissionDeniedError && securityContext) {
            await recordSecurityEventBestEffort({
                organizationId: securityContext.organizationId,
                userId: securityContext.userId,
                eventType: 'authorization.permission.denied',
                outcome: 'DENIED',
                severity: 'WARNING',
                reasonCode: 'MISSING_CAPABILITY',
                module: 'security-audit',
                entityType: 'AuthorizationDecision',
                action: 'READ',
                requestId,
                attributes: error.details && typeof error.details === 'object'
                    ? error.details as Record<string, unknown>
                    : undefined,
            });
        }
        if (isOrganizationContextError(error)) {
            return NextResponse.json(
                { success: false, error: { code: error.code, message: 'No se pudo resolver el contexto de la organización.' }, requestId },
                { status: error.status, headers: { 'x-request-id': requestId } },
            );
        }
        return domainErrorResponse(error, requestId);
    }
}

export const GET = withAuth(getHandler);
