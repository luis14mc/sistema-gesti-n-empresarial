import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { runNotificationRoute } from '@/modules/notifications/presentation/http';
import { notificationQueryService } from '@/modules/notifications/application/queries';

async function handler(request: AuthenticatedRequest) {
  return runNotificationRoute(request, 'list', async ({ requestId, context }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const result = await notificationQueryService.list({
      organizationId: context.organizationId,
      userId: context.userId,
      page,
      pageSize,
      unreadOnly,
    });
    return apiSuccess(result, { requestId });
  });
}

export const GET = withAuth(handler);
