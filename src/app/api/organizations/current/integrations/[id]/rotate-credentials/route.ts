import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runIntegrationRoute } from '@/platform/integrations/presentation/http';
import { integrationConnectionService } from '@/platform/integrations/application/connection-service';
import { rotateCredentialsSchema } from '@/platform/integrations/presentation/schemas';
import { IntegrationNotFoundError } from '@/platform/integrations/domain/integration-errors';

async function handler(request: AuthenticatedRequest, routeContext?: { params: { id: string } }) {
  return runIntegrationRoute(request, 'rotate_credentials', 'integrations.rotate-credentials', async ({ requestId, context }) => {
    const id = routeContext?.params.id;
    if (!id) {
      throw new IntegrationNotFoundError('', context.organizationId);
    }
    const body = rotateCredentialsSchema.parse(await request.json());
    const updated = await integrationConnectionService.rotateCredentials({
      organizationId: context.organizationId,
      integrationId: id,
      secretPayload: body.secretPayload,
      actorUserId: context.userId,
      requestId,
    });
    return apiSuccess({
      integration: {
        id: updated.id,
        provider: updated.provider,
        name: updated.name,
        status: updated.status,
        lastSuccessfulAt: updated.lastSuccessfulAt,
        updatedAt: updated.updatedAt,
        hasSecret: Boolean(updated.secretReference),
      },
    }, { requestId });
  });
}

export const POST = withAuth(handler);
