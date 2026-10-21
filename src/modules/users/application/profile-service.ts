import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  InvalidProfileEmailError,
  InvalidProfileFieldError,
  UserEmailInUseError,
  UserNotFoundError,
} from '@/modules/users/domain/errors';
import {
  emailUsedByOtherUser,
  findMembershipByOrgUser,
  getProfileSnapshot,
  getProfileUser,
  listUserPermissionOverrides,
  updateProfileUser,
} from '@/modules/users/infrastructure/user-repository';
import {
  buildEffectiveModuleMatrix,
  moduleIdsWithRead,
  organizationRoleForSessionRole,
} from '@/platform/security/module-effective';
import {
  createRolePermissionCheck,
  loadOrganizationRolePermissionMap,
} from '@/platform/security/authorization/role-permission-service';
import { getRoleSettingRow } from '@/platform/security/authorization/role-catalog-service';
import { resolveSessionRole } from '@/platform/security/authorization/session-role';
import type { PermissionOverride } from '@/platform/security/authorization/permissions';

export async function getProfile(params: {
  userId: string;
  organizationId: string;
  tokenAccessVersion?: number;
}) {
  const user = await getProfileUser(params.userId);
  if (!user) {
    throw new UserNotFoundError();
  }

  const role = await resolveSessionRole(user.id, user.role);
  const membership = await findMembershipByOrgUser(params.organizationId, user.id);
  const orgRole = membership?.role ?? organizationRoleForSessionRole(role);
  const [overrides, roleMap] = await Promise.all([
    listUserPermissionOverrides(params.organizationId, user.id),
    loadOrganizationRolePermissionMap(params.organizationId),
  ]);
  const roleHas = createRolePermissionCheck(orgRole, roleMap);
  const moduleAccess = buildEffectiveModuleMatrix(
    orgRole,
    overrides as PermissionOverride[],
    roleHas,
  );
  const accessVersion = membership?.accessVersion ?? 0;
  const membershipRole = orgRole;
  let membershipRoleDisplayName: string | null = null;
  try {
    const settings = await getRoleSettingRow(params.organizationId, orgRole);
    membershipRoleDisplayName = settings.displayName;
  } catch {
    membershipRoleDisplayName = null;
  }

  const tokenStale =
    params.tokenAccessVersion !== undefined && params.tokenAccessVersion !== accessVersion;

  return {
    user: {
      ...user,
      role,
      membershipRole,
      membershipRoleDisplayName,
      organizationId: params.organizationId,
      accessVersion,
      modulesRead: moduleIdsWithRead(moduleAccess),
      moduleAccess,
    },
    tokenStale,
  };
}

export async function patchProfile(params: {
  userId: string;
  body: { firstName?: unknown; lastName?: unknown; phone?: unknown; email?: unknown };
}) {
  const { firstName, lastName, phone, email } = params.body;

  if (email !== undefined) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof email !== 'string' || !emailRegex.test(email)) {
      throw new InvalidProfileEmailError();
    }
    const existing = await emailUsedByOtherUser(email, params.userId);
    if (existing) {
      throw new UserEmailInUseError();
    }
  }
  if (firstName !== undefined && typeof firstName !== 'string') {
    throw new InvalidProfileFieldError('Nombre inválido');
  }
  if (lastName !== undefined && typeof lastName !== 'string') {
    throw new InvalidProfileFieldError('Apellido inválido');
  }

  const previous = await getProfileSnapshot(params.userId);
  const user = await updateProfileUser(params.userId, {
    firstName: firstName as string | undefined,
    lastName: lastName as string | undefined,
    phone: phone as string | undefined,
    email: email as string | undefined,
  });

  if (previous) {
    await createAuditRecord({
      title: 'Actualización de perfil propio',
      description: `${user.firstName} ${user.lastName} actualizó su perfil`,
      module: 'USUARIOS',
      category: 'UPDATE',
      userId: params.userId,
      entityId: user.id,
      previousData: { email: previous.email, phone: previous.phone },
      newData: { email: user.email, phone: user.phone },
    });
  }

  return { user };
}
