import type { SessionRole } from '@/lib/session-roles';
import {
  MODULE_CATALOG,
  MODULE_IDS,
  type ModuleAccessRow,
  type ModuleAction,
  type ModuleId,
  emptyModuleAccessRow,
  normalizeModuleRow,
} from '@/platform/security/modules';
import {
  can,
  canWithOverrides,
  organizationRole,
  type OrganizationRole,
  type Permission,
  type PermissionOverride,
  type RolePermissionCheck,
} from '@/platform/security/authorization/permissions';
import { isLockedPermissionForRole } from '@/platform/security/authorization/role-permission-locks';

export type EffectiveModuleAccess = Record<ModuleId, ModuleAccessRow>;

export type CellOrigin = 'inherited' | 'allow' | 'deny';

export type ModuleCellState = {
  effective: boolean;
  roleDefault: boolean;
  origin: CellOrigin;
};

const SESSION_TO_ORG_ROLE: Partial<Record<SessionRole, OrganizationRole>> = {
  RRHH: 'HR',
  IT: 'IT_MANAGER',
};

export function organizationRoleForSessionRole(role: SessionRole): OrganizationRole {
  if (role in SESSION_TO_ORG_ROLE) return SESSION_TO_ORG_ROLE[role as keyof typeof SESSION_TO_ORG_ROLE]!;
  return role as OrganizationRole;
}

function permissionsForAction(moduleId: ModuleId, action: ModuleAction): readonly Permission[] {
  return MODULE_CATALOG[moduleId].permissionMap[action] ?? [];
}

function permissionsForSpecial(moduleId: ModuleId, specialId: Permission): readonly Permission[] {
  return MODULE_CATALOG[moduleId].specials.some((s) => s.id === specialId) ? [specialId] : [];
}

export function isPermissionEffective(
  orgRole: OrganizationRole,
  permission: Permission,
  overrides: readonly PermissionOverride[],
  roleHas?: RolePermissionCheck,
): boolean {
  return canWithOverrides(organizationRole(orgRole), permission, overrides, roleHas);
}

export function isActionEffective(
  orgRole: OrganizationRole,
  moduleId: ModuleId,
  action: ModuleAction,
  overrides: readonly PermissionOverride[],
  roleHas?: RolePermissionCheck,
): boolean {
  const perms = permissionsForAction(moduleId, action);
  if (!perms.length) return false;
  return perms.some((p) => isPermissionEffective(orgRole, p, overrides, roleHas));
}

export function isSpecialEffective(
  orgRole: OrganizationRole,
  moduleId: ModuleId,
  special: Permission,
  overrides: readonly PermissionOverride[],
  roleHas?: RolePermissionCheck,
): boolean {
  if (!permissionsForSpecial(moduleId, special).length) return false;
  if (!isActionEffective(orgRole, moduleId, 'read', overrides, roleHas)) return false;
  return isPermissionEffective(orgRole, special, overrides, roleHas);
}

export function emptyMatrix(): EffectiveModuleAccess {
  return Object.fromEntries(MODULE_IDS.map((id) => [id, emptyModuleAccessRow(id)])) as EffectiveModuleAccess;
}

export function buildEffectiveModuleMatrix(
  orgRole: OrganizationRole,
  overrides: readonly PermissionOverride[],
  roleHas?: RolePermissionCheck,
): EffectiveModuleAccess {
  const matrix = emptyMatrix();
  for (const moduleId of MODULE_IDS) {
    const def = MODULE_CATALOG[moduleId];
    const row: ModuleAccessRow = {
      module: moduleId,
      canRead: isActionEffective(orgRole, moduleId, 'read', overrides, roleHas),
      canCreate: def.crud.create && isActionEffective(orgRole, moduleId, 'create', overrides, roleHas),
      canUpdate: def.crud.update && isActionEffective(orgRole, moduleId, 'update', overrides, roleHas),
      canDelete: def.crud.delete && isActionEffective(orgRole, moduleId, 'delete', overrides, roleHas),
      extras: def.specials
        .filter((s) => isSpecialEffective(orgRole, moduleId, s.id, overrides, roleHas))
        .map((s) => s.id),
    };
    matrix[moduleId] = normalizeModuleRow(row);
  }
  return matrix;
}

export function sessionRoleModuleMatrix(role: SessionRole): EffectiveModuleAccess {
  return buildEffectiveModuleMatrix(organizationRoleForSessionRole(role), []);
}

export function moduleIdsWithRead(matrix: EffectiveModuleAccess): ModuleId[] {
  return MODULE_IDS.filter((id) => matrix[id].canRead);
}

export function cellState(
  orgRole: OrganizationRole,
  moduleId: ModuleId,
  action: ModuleAction,
  overrides: readonly PermissionOverride[],
  roleHas?: RolePermissionCheck,
): ModuleCellState {
  const effective = isActionEffective(orgRole, moduleId, action, overrides, roleHas);
  const roleDefault = isActionEffective(orgRole, moduleId, action, [], roleHas);
  let origin: CellOrigin = 'inherited';
  if (effective !== roleDefault) {
    origin = effective ? 'allow' : 'deny';
  }
  return { effective, roleDefault, origin };
}

export function specialCellState(
  orgRole: OrganizationRole,
  moduleId: ModuleId,
  special: Permission,
  overrides: readonly PermissionOverride[],
  roleHas?: RolePermissionCheck,
): ModuleCellState {
  const effective = isSpecialEffective(orgRole, moduleId, special, overrides, roleHas);
  const roleDefault = isSpecialEffective(orgRole, moduleId, special, [], roleHas);
  let origin: CellOrigin = 'inherited';
  if (effective !== roleDefault) origin = effective ? 'allow' : 'deny';
  return { effective, roleDefault, origin };
}

/** Apply UI rule: create/update/delete imply read when enabling. */
export function normalizeDesiredRow(row: ModuleAccessRow): ModuleAccessRow {
  let next = { ...row };
  if (next.canCreate || next.canUpdate || next.canDelete) next.canRead = true;
  if (!next.canRead) {
    next = { ...next, canCreate: false, canUpdate: false, canDelete: false, extras: [] };
  }
  return normalizeModuleRow(next);
}

export function overridesFromDesiredMatrix(
  orgRole: OrganizationRole,
  currentOverrides: readonly PermissionOverride[],
  desired: ModuleAccessRow,
  roleHas?: RolePermissionCheck,
): PermissionOverride[] {
  const row = normalizeDesiredRow(desired);
  const moduleId = row.module;
  const scoped = currentOverrides.filter((o) => !permissionBelongsToModule(o.permission as Permission, moduleId));

  const next = [...scoped];

  for (const action of ['read', 'create', 'update', 'delete'] as const) {
    if (!MODULE_CATALOG[moduleId].crud[action]) continue;
    const want = action === 'read' ? row.canRead : action === 'create' ? row.canCreate : action === 'update' ? row.canUpdate : row.canDelete;
    applyActionTarget(orgRole, next, moduleId, action, want, roleHas);
  }

  for (const special of MODULE_CATALOG[moduleId].specials) {
    const want = row.extras.includes(special.id);
    applyPermissionTarget(orgRole, next, special.id, want, roleHas);
  }

  return dedupeOverrides(next);
}

function permissionBelongsToModule(permission: Permission, moduleId: ModuleId): boolean {
  const def = MODULE_CATALOG[moduleId];
  for (const action of ['read', 'create', 'update', 'delete'] as const) {
    if ((def.permissionMap[action] ?? []).includes(permission)) return true;
  }
  return def.specials.some((s) => s.id === permission);
}

function applyActionTarget(
  orgRole: OrganizationRole,
  overrides: PermissionOverride[],
  moduleId: ModuleId,
  action: ModuleAction,
  want: boolean,
  roleHasCheck?: RolePermissionCheck,
) {
  for (const permission of permissionsForAction(moduleId, action)) {
    applyPermissionTarget(orgRole, overrides, permission, want, roleHasCheck);
  }
}

function applyPermissionTarget(
  orgRole: OrganizationRole,
  overrides: PermissionOverride[],
  permission: Permission,
  want: boolean,
  roleHasCheck?: RolePermissionCheck,
) {
  if (!want && isLockedPermissionForRole(orgRole, permission)) {
    return;
  }
  const roleHas = roleHasCheck
    ? roleHasCheck(permission)
    : can(organizationRole(orgRole), permission);
  const idx = overrides.findIndex((o) => o.permission === permission);
  if (want === roleHas) {
    if (idx >= 0) overrides.splice(idx, 1);
    return;
  }
  const effect = want ? ('ALLOW' as const) : ('DENY' as const);
  if (effect === 'DENY' && isLockedPermissionForRole(orgRole, permission)) {
    return;
  }
  if (idx >= 0) overrides[idx] = { permission, effect };
  else overrides.push({ permission, effect });
}

function dedupeOverrides(overrides: PermissionOverride[]): PermissionOverride[] {
  const byPerm = new Map<string, PermissionOverride>();
  for (const o of overrides) byPerm.set(o.permission, o);
  return [...byPerm.values()];
}

export function clearAllOverrides(): PermissionOverride[] {
  return [];
}
