import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  CannotResetOwnerPasswordError,
  UseSelfPasswordChangeError,
  UserNotFoundError,
} from '@/modules/users/domain/errors';
import { findActiveMembership, updatePasswordAndBumpAccess } from '@/modules/users/infrastructure/user-repository';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';
import type { z } from 'zod';
import type { adminPasswordResetSchema } from '@/modules/users/presentation/schemas/users';

type AdminPasswordResetInput = z.infer<typeof adminPasswordResetSchema>;

export async function adminResetUserPassword(params: {
  organizationId: string;
  actorUserId: string;
  actorRole: OrganizationRole;
  targetUserId: string;
  input: AdminPasswordResetInput;
  hashPassword: (plain: string) => Promise<string>;
}) {
  const {
    organizationId,
    actorUserId,
    actorRole,
    targetUserId,
    input,
    hashPassword,
  } = params;
  const { newPassword, mustChangePassword } = input;

  if (targetUserId === actorUserId) {
    throw new UseSelfPasswordChangeError();
  }

  const membership = await findActiveMembership(organizationId, targetUserId);
  if (!membership) {
    throw new UserNotFoundError();
  }

  if (membership.role === 'OWNER' && actorRole !== 'OWNER') {
    throw new CannotResetOwnerPasswordError();
  }

  const hashed = await hashPassword(newPassword);
  await updatePasswordAndBumpAccess({
    userId: targetUserId,
    organizationId,
    passwordHash: hashed,
    mustChangePassword,
    membershipId: membership.id,
  });

  await createAuditRecord({
    title: 'PASSWORD_RESET_BY_ADMIN',
    description: `Restablecimiento de contraseña para ${membership.user.firstName} ${membership.user.lastName} (${membership.user.email})`,
    module: 'USUARIOS',
    category: 'UPDATE',
    userId: actorUserId,
    entityId: targetUserId,
    organizationId,
    newData: {
      targetUserId,
      mustChangePassword,
      actorUserId,
    },
  });

  return { success: true as const };
}
