import { withAuth } from '@/lib/middleware';
import {
  deleteUserById,
  getUserById,
  patchUserById,
} from '@/modules/users/application/user-detail-service';

/**
 * DELETE searchParams.get('hard') === 'true' → countBlockingUserReferences; 409 «Tiene historial; desactívelo en su lugar».
 */
export const GET = withAuth(getUserById);
export const PATCH = withAuth(patchUserById);
export const DELETE = withAuth(deleteUserById);
