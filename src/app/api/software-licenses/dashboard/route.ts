import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { licenseDashboard, syncRenewalNotifications } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'software-licenses.read');
    await syncRenewalNotifications(organizationId);
    return apiSuccess(await licenseDashboard(organizationId), { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
