import { withAuth } from '@/lib/middleware';
import {
  getRolePermissions,
  putRolePermissions,
} from '@/modules/users/application/role-permissions-service';

export const GET = withAuth(getRolePermissions);
export const PUT = withAuth(putRolePermissions);
