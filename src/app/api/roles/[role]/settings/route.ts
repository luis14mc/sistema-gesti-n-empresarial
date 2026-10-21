import { withAuth } from '@/lib/middleware';
import { getRoleSettings, putRoleSettings } from '@/modules/users/application/role-settings-service';

export const GET = withAuth(getRoleSettings);
export const PUT = withAuth(putRoleSettings);
