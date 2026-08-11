import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runNotificationRoute } from '@/modules/notifications/presentation/http';
import { notificationCommandService } from '@/modules/notifications/application/queries';

async function handler(request: AuthenticatedRequest) {
  return runNotificationRoute(request, 'read_all', async ({ requestId, context }) => {
    const result = await notificationCommandService.markAllRead({
      organizationId: context.organizationId,
      userId: context.userId,
      requestId,
    });
    return apiSuccess({ updated: result.updated }, { requestId });
  });
}

export const POST = withAuth(handler);
