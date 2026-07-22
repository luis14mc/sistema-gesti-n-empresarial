import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { disposalReasonSchema } from '@/modules/equipment-disposal/presentation/schemas/disposal';
import { equipmentDisposalService } from '@/modules/equipment-disposal/application/service';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'cancel', async ({ context, requestId }) => {
    const { id } = await params;
    const { reason } = disposalReasonSchema.parse(await request.json());
    return apiSuccess(await equipmentDisposalService.cancel(context, id, reason, requestId), { requestId });
  });
}
export const POST = withAuth(handler);
