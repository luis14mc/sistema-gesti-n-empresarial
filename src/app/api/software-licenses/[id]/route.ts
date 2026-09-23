import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { updateSubscriptionSchema } from '@/lib/software-licenses/schemas';
import { getSoftwareSubscription, updateSoftwareSubscription } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

async function getHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'software-licenses.read');
    const { id } = await params;
    const subscription = await getSoftwareSubscription(id, organizationId);
    if (!subscription) throw new Error('SUBSCRIPTION_NOT_FOUND');
    return apiSuccess(subscription, { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

async function patchHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.update');
    const { id } = await params;
    const input = updateSubscriptionSchema.parse(await req.json());
    return apiSuccess(await updateSoftwareSubscription(id, input, organizationId, userId), { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
