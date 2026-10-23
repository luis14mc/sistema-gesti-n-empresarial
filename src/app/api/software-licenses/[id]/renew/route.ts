import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { registerRenewalSchema } from '@/modules/software-licenses/presentation/schemas';
import { registerSubscriptionRenewal } from '@/modules/software-licenses/application/service';
import { licenseFailure } from '@/modules/software-licenses/presentation/http';

async function postHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.update');
    const { id } = await params;
    const body = registerRenewalSchema.parse(await req.json());
    const subscription = await registerSubscriptionRenewal(id, body, organizationId, userId);
    return apiSuccess(subscription, { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
