import { withAuth } from '@/lib/middleware';
import { postChangePassword } from '@/modules/users/application/change-password-service';

/** Same response issues generateSessionToken(…) and res.cookies.set('token', …) via change-password-service. */
export const POST = withAuth(postChangePassword);
