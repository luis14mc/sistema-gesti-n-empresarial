import type { Prisma } from '@prisma/client';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { runIntegrationRoute } from '@/platform/integrations/presentation/http';
import { integrationQueries } from '@/platform/integrations/application/integration-queries';
import { updateIntegrationSchema } from '@/platform/integrations/presentation/schemas';
import { integrationConnectionService } from '@/platform/integrations/application/connection-service';
import { integrationExecutionService } from '@/platform/integrations/application/execution-service';
import { IntegrationNotFoundError } from '@/platform/integrations/domain/integration-errors';

async function getHandler(request: AuthenticatedRequest, routeContext?: { params: { id: string } }) {
  return runIntegrationRoute(request, 'inspect_integration', 'integrations.read', async ({ requestId, context }) => {
    const id = routeContext?.params.id;
    if (!id) {
      throw new IntegrationNotFoundError('', context.organizationId);
    }
    const integration = await integrationQueries.find(context.organizationId, id);
    if (!integration) throw new IntegrationNotFoundError(id, context.organizationId);
    const health = await integrationExecutionService.computeIntegrationHealth(integration);
    return apiSuccess({
      integration: {
        id: integration.id,
        provider: integration.provider,
        name: integration.name,
        status: integration.status,
        capabilities: integration.capabilities,
        publicConfig: integration.publicConfig,
        lastTestedAt: integration.lastTestedAt,
        lastSuccessfulAt: integration.lastSuccessfulAt,
        lastFailureAt: integration.lastFailureAt,
        lastErrorCode: integration.lastErrorCode,
        lastErrorMessage: integration.lastErrorMessage,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
        hasSecret: Boolean(integration.secretReference),
        health,
      },
    }, { requestId });
  });
}

async function patchHandler(request: AuthenticatedRequest, routeContext?: { params: { id: string } }) {
  return runIntegrationRoute(request, 'update_integration', 'integrations.update', async ({ requestId, context }) => {
    const id = routeContext?.params.id;
    if (!id) {
      throw new IntegrationNotFoundError('', context.organizationId);
    }
    const body = updateIntegrationSchema.parse(await request.json());
    const updated = await integrationConnectionService.update({
      organizationId: context.organizationId,
      integrationId: id,
      name: body.name,
      capabilities: body.capabilities,
      publicConfig: (body.publicConfig as Prisma.InputJsonValue | null | undefined) ?? undefined,
      status: body.status,
      actorUserId: context.userId,
      requestId,
    });
    return apiSuccess({ integration: updated }, { requestId });
  });
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
