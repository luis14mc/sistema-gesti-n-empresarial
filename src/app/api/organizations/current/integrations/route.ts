import { Prisma } from '@prisma/client';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runIntegrationRoute } from '@/platform/integrations/presentation/http';
import { prisma } from '@/lib/prisma';
import { integrationRegistry } from '@/platform/integrations/application/registry';
import { integrationsListQuerySchema, createIntegrationSchema } from '@/platform/integrations/presentation/schemas';
import { integrationConnectionService } from '@/platform/integrations/application/connection-service';
import { integrationExecutionService } from '@/platform/integrations/application/execution-service';

async function getHandler(request: AuthenticatedRequest) {
  return runIntegrationRoute(request, 'list_integrations', 'integrations.read', async ({ requestId, context }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = integrationsListQuerySchema.parse(params);
    const page = parsed.page ?? 1;
    const pageSize = parsed.pageSize ?? 20;
    const where = {
      organizationId: context.organizationId,
      ...(parsed.provider ? { provider: parsed.provider } : {}),
      ...(parsed.status ? { status: parsed.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.organizationIntegration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.organizationIntegration.count({ where }),
    ]);
    const itemsWithHealth = await Promise.all(items.map(async (item) => {
      const health = await integrationExecutionService.computeIntegrationHealth(item);
      return {
        id: item.id,
        organizationId: item.organizationId,
        provider: item.provider,
        name: item.name,
        status: item.status,
        capabilities: item.capabilities,
        publicConfig: item.publicConfig,
        lastTestedAt: item.lastTestedAt,
        lastSuccessfulAt: item.lastSuccessfulAt,
        lastFailureAt: item.lastFailureAt,
        lastErrorCode: item.lastErrorCode,
        lastErrorMessage: item.lastErrorMessage,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        health,
      };
    }));
    return apiSuccess({
      items: itemsWithHealth,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      providers: integrationRegistry.list(),
    }, { requestId });
  });
}

async function postHandler(request: AuthenticatedRequest) {
  return runIntegrationRoute(request, 'create_integration', 'integrations.create', async ({ requestId, context }) => {
    const body = createIntegrationSchema.parse(await request.json());
    const integration = await integrationConnectionService.create({
      organizationId: context.organizationId,
      provider: body.provider,
      name: body.name,
      capabilities: body.capabilities,
      publicConfig: (body.publicConfig as Prisma.InputJsonValue | null | undefined) ?? null,
      secretPayload: body.secretPayload,
      actorUserId: context.userId,
      requestId,
    });
    return apiSuccess({ integration }, { requestId, status: 201 });
  });
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
