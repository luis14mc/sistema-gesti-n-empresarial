import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runIntegrationRoute } from '@/platform/integrations/presentation/http';
import { integrationConnectionService } from '@/platform/integrations/application/connection-service';
import { IntegrationNotFoundError } from '@/platform/integrations/domain/integration-errors';

async function handler(request: AuthenticatedRequest, routeContext?: { params: { id: string } }) {
  return runIntegrationRoute(request, 'test_integration', 'integrations.test', async ({ requestId, context }) => {
    const id = routeContext?.params.id;
    if (!id) {
      throw new IntegrationNotFoundError('', context.organizationId);
    }
    const result = await integrationConnectionService.testConnection({
      organizationId: context.organizationId,
      integrationId: id,
      actorUserId: context.userId,
      requestId,
    });
    return apiSuccess({ result }, { requestId });
  });
}

export const POST = withAuth(handler);
