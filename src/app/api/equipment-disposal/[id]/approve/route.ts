import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { equipmentDisposalService } from '@/modules/equipment-disposal/application/service';
import { createRateLimiter, rateLimitHeaders } from '@/lib/rate-limit';
import { apiFailure } from '@/platform/api/response';

const approvalLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimit = approvalLimiter.check(request.user?.userId ?? 'anonymous');
  if (!rateLimit.success) {
    return apiFailure('RATE_LIMITED', 'Demasiadas solicitudes de aprobación.', {
      requestId: crypto.randomUUID(), status: 429, headers: rateLimitHeaders(rateLimit),
    });
  }
  return runDisposalRoute(request, 'approve', async ({ context, requestId }) => {
    const { id } = await params;
    return apiSuccess(await equipmentDisposalService.approve(context, id, requestId), { requestId });
  });
}
export const POST = withAuth(handler);
