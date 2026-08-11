import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runPlatformRoute } from '@/modules/organizations/presentation/platform-http';
import { organizationPlatformQueryService } from '@/modules/organizations/application/queries';
import { OrganizationNotFoundError } from '@/modules/organizations/domain/errors';

async function getHandler(request: AuthenticatedRequest, context?: { params: { id: string } }) {
  return runPlatformRoute(request, 'inspect_organization', async ({ requestId }) => {
    const id = context?.params.id;
    if (!id) {
      return apiSuccess({ organization: null, activity: [] }, { requestId });
    }
    const [organization, activity] = await Promise.all([
      organizationPlatformQueryService.findById(id),
      organizationPlatformQueryService.recentActivity(id, 25),
    ]);
    if (!organization) throw new OrganizationNotFoundError(id);
    return apiSuccess({ organization, activity }, { requestId });
  });
}

export const GET = withAuth(getHandler);
