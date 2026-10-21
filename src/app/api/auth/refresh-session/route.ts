import { withAuth } from '@/lib/middleware';
import { postRefreshSession } from '@/modules/users/application/refresh-session-service';

export const POST = withAuth(postRefreshSession);
