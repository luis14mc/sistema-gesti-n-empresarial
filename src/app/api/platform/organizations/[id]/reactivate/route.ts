import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runPlatformRoute } from '@/modules/organizations/presentation/platform-http';
import { organizationLifecycleService } from '@/modules/organizations/application/lifecycle';
import { organizationLifecycleReasonSchema } from '@/modules/organizations/presentation/schemas/lifecycle';

async function handler(request: AuthenticatedRequest, context?: { params: { id: string } }) {
  return runPlatformRoute(request, 'reactivate_organization', async ({ requestId, context: platform }) => {
    const id = context?.params.id;
    if (!id) {
      throw new Error('Organization id is required');
    }
    const body = organizationLifecycleReasonSchema.parse(await request.json().catch(() => ({})));
    const organization = await organizationLifecycleService.reactivate(
      { organizationId: id, reason: body.reason },
      { ...platform, requestId },
    );
    return apiSuccess({ organizationId: organization.id, status: organization.status, suspendedAt: organization.suspendedAt }, { requestId });
  });
}

export const POST = withAuth(handler);
