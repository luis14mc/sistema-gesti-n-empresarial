import { InvalidSessionError } from '@/modules/users/domain/errors';
import { findUserForSession } from '@/modules/users/infrastructure/user-repository';
import { resolveSessionRole } from '@/platform/security/authorization/session-role';

export async function refreshSession(params: { userId: string }) {
  const user = await findUserForSession(params.userId);
  if (!user?.isActive) {
    throw new InvalidSessionError();
  }

  const sessionRole = await resolveSessionRole(params.userId, user.role);
  return { email: user.email, sessionRole };
}
