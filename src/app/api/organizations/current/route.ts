import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { isOrganizationContextError, requireOrganizationContext } from '@/modules/organizations/application/context';
import { apiSuccess, apiFailure } from '@/platform/api/response';

async function handler(request: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await requireOrganizationContext(request, requestId);
    const organization = await prisma.organization.findUnique({ where: { id: context.organizationId }, select: { id: true, slug: true, name: true, logoKey: true } });
    if (!organization) return apiFailure('ORGANIZATION_NOT_FOUND', 'La organización no existe.', { requestId, status: 404 });
    return apiSuccess({
      organization: { id: organization.id, slug: organization.slug, name: organization.name, logoUrl: organization.logoKey },
      membership: { id: context.membershipId, role: context.role },
    }, { requestId });
  } catch (error) {
    if (isOrganizationContextError(error)) {
      const messages = {
        AUTHENTICATION_REQUIRED: 'Debe iniciar sesión para continuar.',
        ORGANIZATION_MEMBERSHIP_REQUIRED: 'El usuario no pertenece a una organización activa.',
        ORGANIZATION_SELECTION_REQUIRED: 'Seleccione la organización con la que desea trabajar.',
        TENANT_ACCESS_DENIED: 'No tiene acceso a la organización seleccionada.',
      };
      return apiFailure(error.code, messages[error.code], {
        requestId, status: error.status, stage: 'RESOLVE_ORGANIZATION_CONTEXT', details: [],
      });
    }
    console.error('[CURRENT ORGANIZATION ERROR]', { requestId, error });
    return apiFailure('INTERNAL_ERROR', 'No se pudo resolver la organización actual.', { requestId, status: 500, stage: 'RESOLVE_ORGANIZATION_CONTEXT', details: [] });
  }
}
export const GET = withAuth(handler);
