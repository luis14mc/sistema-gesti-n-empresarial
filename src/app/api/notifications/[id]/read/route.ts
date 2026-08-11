import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runNotificationRoute } from '@/modules/notifications/presentation/http';
import { notificationCommandService } from '@/modules/notifications/application/queries';

async function handler(request: AuthenticatedRequest, routeContext?: { params: { id: string } }) {
  return runNotificationRoute(request, 'mark_read', async ({ requestId, context }) => {
    const id = routeContext?.params.id;
    if (!id) {
      return apiSuccess({ ok: false }, { requestId, status: 400 });
    }
    const notification = await notificationCommandService.markRead({
      organizationId: context.organizationId,
      userId: context.userId,
      notificationId: id,
      requestId,
    });
    return apiSuccess({ notification }, { requestId });
  });
}

export const POST = withAuth(handler);
