import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runIntegrationRoute } from '@/platform/integrations/presentation/http';
import { integrationConnectionService } from '@/platform/integrations/application/connection-service';
import { setIntegrationStatusSchema } from '@/platform/integrations/presentation/schemas';
import { IntegrationNotFoundError } from '@/platform/integrations/domain/integration-errors';

async function handler(request: AuthenticatedRequest, routeContext?: { params: { id: string } }) {
  return runIntegrationRoute(request, 'disable_integration', 'integrations.disable', async ({ requestId, context }) => {
    const id = routeContext?.params.id;
    if (!id) {
      throw new IntegrationNotFoundError('', context.organizationId);
    }
    const body = setIntegrationStatusSchema.parse(await request.json().catch(() => ({})));
    const updated = await integrationConnectionService.setStatus({
      organizationId: context.organizationId,
      integrationId: id,
      status: body.status,
      actorUserId: context.userId,
      requestId,
    });
    return apiSuccess({ integration: updated }, { requestId });
  });
}

export const POST = withAuth(handler);
