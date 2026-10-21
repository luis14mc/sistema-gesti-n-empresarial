import { withAuth } from '@/lib/middleware';
import { postAdminPasswordReset } from '@/modules/users/application/user-password-admin-service';

/**
 * Guard: authorizeOrganization(req, requestId, 'users.update')
 * Audit: PASSWORD_RESET_BY_ADMIN — newData: { mustChangePassword }; accessVersion bump in service.
 */
export const POST = withAuth(postAdminPasswordReset);
