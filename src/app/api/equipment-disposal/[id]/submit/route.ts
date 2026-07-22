import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { equipmentDisposalService } from '@/modules/equipment-disposal/application/service';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'submit', async ({ context, requestId }) => {
    const { id } = await params;
    return apiSuccess(await equipmentDisposalService.submit(context, id, requestId), { requestId });
  });
}
export const POST = withAuth(handler);
