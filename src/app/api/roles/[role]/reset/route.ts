import { withAuth } from '@/lib/middleware';
import { postRoleReset } from '@/modules/users/application/role-reset-service';

export const POST = withAuth(postRoleReset);
