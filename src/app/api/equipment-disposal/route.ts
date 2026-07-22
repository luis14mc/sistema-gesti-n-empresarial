import type { DisposalStatus } from '@prisma/client';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { disposalEvaluationSchema } from '@/modules/equipment-disposal/presentation/schemas/disposal';
import { equipmentDisposalService } from '@/modules/equipment-disposal/application/service';

async function getHandler(request: AuthenticatedRequest) {
  return runDisposalRoute(request, 'list', async ({ context, requestId }) => {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize')) || 20));
    const status = params.get('status') as DisposalStatus | null;
    const result = await equipmentDisposalService.list(context, {
      page, pageSize, status: status ?? undefined, search: params.get('search') ?? undefined,
    });
    return apiSuccess(result, { requestId });
  });
}

async function postHandler(request: AuthenticatedRequest) {
  return runDisposalRoute(request, 'create', async ({ context, requestId }) => {
    const input = disposalEvaluationSchema.parse(await request.json());
    const result = await equipmentDisposalService.createDraft(context, input, requestId);
    return apiSuccess(result, { requestId, status: 201 });
  });
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
