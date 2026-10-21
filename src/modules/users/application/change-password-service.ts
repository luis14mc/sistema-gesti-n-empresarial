import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  InvalidCredentialsError,
  PasswordSameAsCurrentError,
  UserNotFoundError,
} from '@/modules/users/domain/errors';
import {
  findUserWithPassword,
  updatePasswordAndBumpAccess,
} from '@/modules/users/infrastructure/user-repository';

export async function changeOwnPassword(params: {
  userId: string;
  organizationId: string;
  currentPassword: string;
  newPassword: string;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
  hashPassword: (plain: string) => Promise<string>;
}) {
  const { userId, organizationId, currentPassword, newPassword, comparePassword, hashPassword } = params;

  if (currentPassword === newPassword) {
    throw new PasswordSameAsCurrentError();
  }

  const user = await findUserWithPassword(userId);
  if (!user) {
    throw new UserNotFoundError();
  }

  const currentOk = await comparePassword(currentPassword, user.password);
  if (!currentOk) {
    throw new InvalidCredentialsError();
  }

  const newHashed = await hashPassword(newPassword);
  await updatePasswordAndBumpAccess({
    userId: user.id,
    organizationId,
    passwordHash: newHashed,
    mustChangePassword: false,
    bumpAllMemberships: true,
  });

  await createAuditRecord({
    title: 'Cambio de contraseña',
    description: `El usuario ${user.email} cambió su contraseña`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: user.id,
    entityId: user.id,
  });

  return { userId: user.id, email: user.email, legacyRole: user.role };
}
