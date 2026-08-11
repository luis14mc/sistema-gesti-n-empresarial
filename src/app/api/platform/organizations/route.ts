import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runPlatformRoute } from '@/modules/organizations/presentation/platform-http';
import { createOrganizationSchema, organizationListQuerySchema } from '@/modules/organizations/presentation/schemas/lifecycle';
import { organizationPlatformQueryService } from '@/modules/organizations/application/queries';
import { organizationLifecycleService } from '@/modules/organizations/application/lifecycle';

async function getHandler(request: AuthenticatedRequest) {
  return runPlatformRoute(request, 'list_organizations', async ({ requestId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = organizationListQuerySchema.parse(params);
    const result = await organizationPlatformQueryService.list({
      status: parsed.status,
      search: parsed.search,
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
    });
    return apiSuccess(result, { requestId });
  });
}

async function postHandler(request: AuthenticatedRequest) {
  return runPlatformRoute(request, 'create_organization', async ({ requestId, context }) => {
    const body = await request.json();
    const parsed = createOrganizationSchema.parse(body);
    const organization = await organizationLifecycleService.create(
      {
        name: parsed.name,
        slug: parsed.slug ?? parsed.name,
        legalName: parsed.legalName ?? null,
        rtn: parsed.rtn ?? null,
        timezone: parsed.timezone,
        locale: parsed.locale,
        currency: parsed.currency,
        primaryContactName: parsed.primaryContactName ?? null,
        primaryContactEmail: parsed.primaryContactEmail ?? null,
        primaryContactPhone: parsed.primaryContactPhone ?? null,
      },
      { ...context, requestId },
    );
    return apiSuccess(organization, { requestId, status: 201 });
  });
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
