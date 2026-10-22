import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { licenseDashboard, syncRenewalNotifications } from '@/modules/software-licenses/application/service';
import { licenseFailure } from '@/modules/software-licenses/presentation/http';

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
