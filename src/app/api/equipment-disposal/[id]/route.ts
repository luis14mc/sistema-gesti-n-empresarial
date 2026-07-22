import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { equipmentDisposalService } from '@/modules/equipment-disposal/application/service';
import { updateDisposalSchema } from '@/modules/equipment-disposal/presentation/schemas/disposal';

async function getHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'read', async ({ context, requestId }) => {
    const { id } = await params;
    return apiSuccess(await equipmentDisposalService.get(context, id), { requestId });
  });
}

export const GET = withAuth(getHandler);

async function patchHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'update', async ({ context, requestId }) => {
    const { id } = await params;
    const input = updateDisposalSchema.parse(await request.json());
    return apiSuccess(await equipmentDisposalService.updateDraft(context, id, input, requestId), { requestId });
  });
}

export const PATCH = withAuth(patchHandler);
