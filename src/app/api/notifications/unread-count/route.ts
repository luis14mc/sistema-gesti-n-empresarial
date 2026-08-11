import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runNotificationRoute } from '@/modules/notifications/presentation/http';
import { notificationQueryService } from '@/modules/notifications/application/queries';

async function handler(request: AuthenticatedRequest) {
  return runNotificationRoute(request, 'unread_count', async ({ requestId, context }) => {
    const count = await notificationQueryService.unreadCount(context.organizationId, context.userId);
    return apiSuccess({ unreadCount: count, organizationId: context.organizationId }, { requestId });
  });
}

export const GET = withAuth(handler);
