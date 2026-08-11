import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runIntegrationRoute } from '@/platform/integrations/presentation/http';
import { integrationExecutionService } from '@/platform/integrations/application/execution-service';
import { executionsListQuerySchema } from '@/platform/integrations/presentation/schemas';
import { IntegrationNotFoundError } from '@/platform/integrations/domain/integration-errors';
import { prisma } from '@/lib/prisma';

async function handler(request: AuthenticatedRequest, routeContext?: { params: { id: string } }) {
  return runIntegrationRoute(request, 'list_executions', 'integrations.view-history', async ({ requestId, context }) => {
    const id = routeContext?.params.id;
    if (!id) {
      throw new IntegrationNotFoundError('', context.organizationId);
    }
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = executionsListQuerySchema.parse(params);
    const integration = await prisma.organizationIntegration.findFirst({
      where: { id, organizationId: context.organizationId },
      select: { id: true },
    });
    if (!integration) throw new IntegrationNotFoundError(id, context.organizationId);
    const result = await integrationExecutionService.listRecentExecutions({
      organizationId: context.organizationId,
      integrationId: id,
      page: parsed.page ?? 1,
      pageSize: parsed.pageSize ?? 20,
      status: parsed.status,
    });
    return apiSuccess(result, { requestId });
  });
}

export const GET = withAuth(handler);
