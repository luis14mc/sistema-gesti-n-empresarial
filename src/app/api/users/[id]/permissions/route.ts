import { withAuth } from '@/lib/middleware';
import {
  deleteUserPermissionOverrides,
  getUserPermissionOverrides,
  putUserPermissionOverrides,
} from '@/modules/users/application/user-permission-overrides-service';

export const GET = withAuth(getUserPermissionOverrides);
export const PUT = withAuth(putUserPermissionOverrides);
export const DELETE = withAuth(deleteUserPermissionOverrides);
