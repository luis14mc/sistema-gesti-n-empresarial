import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runPlatformRoute } from '@/modules/organizations/presentation/platform-http';
import { organizationLifecycleService } from '@/modules/organizations/application/lifecycle';

async function handler(request: AuthenticatedRequest, context?: { params: { id: string } }) {
  return runPlatformRoute(request, 'activate_organization', async ({ requestId, context: platform }) => {
    const id = context?.params.id;
    if (!id) {
      throw new Error('Organization id is required');
    }
    const organization = await organizationLifecycleService.activate(
      { organizationId: id },
      { ...platform, requestId },
    );
    return apiSuccess({ organizationId: organization.id, status: organization.status }, { requestId });
  });
}

export const POST = withAuth(handler);
