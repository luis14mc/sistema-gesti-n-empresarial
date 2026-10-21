import { withAuth } from '@/lib/middleware';
import { getProfile, patchProfile } from '@/modules/users/application/profile-service';

export const GET = withAuth(getProfile);
export const PATCH = withAuth(patchProfile);
