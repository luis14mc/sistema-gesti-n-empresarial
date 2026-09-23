import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { createSubscriptionSchema, licenseListQuerySchema } from '@/lib/software-licenses/schemas';
import { createSoftwareSubscription, listSoftwareSubscriptions, syncRenewalNotifications } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'software-licenses.read');
    const query = licenseListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    await syncRenewalNotifications(organizationId);
    const items = await listSoftwareSubscriptions(organizationId, query);
    const start = (query.page - 1) * query.pageSize;
    return apiSuccess({
      items: items.slice(start, start + query.pageSize),
      meta: { total: items.length, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(items.length / query.pageSize) },
    }, { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.create');
    const input = createSubscriptionSchema.parse(await req.json());
    const subscription = await createSoftwareSubscription(input, organizationId, userId);
    return apiSuccess(subscription, { requestId, status: 201 });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
