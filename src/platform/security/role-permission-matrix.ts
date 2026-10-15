import {
  MODULE_CATALOG,
  MODULE_IDS,
  permissionsFromModuleRow,
  type ModuleAccessRow,
  emptyModuleAccessRow,
  normalizeModuleRow,
  type ModuleId,
} from '@/platform/security/modules';
import type { OrganizationRole, Permission } from '@/platform/security/authorization/permissions';
import {
  isActionEffective,
  isSpecialEffective,
} from '@/platform/security/module-effective';
import { createRolePermissionCheck } from '@/platform/security/authorization/role-permission-service';
import type { OrganizationRolePermissionMap } from '@/platform/security/authorization/role-permission-service';
import { officialPermissionSetForRole } from '@/platform/security/authorization/official-role-permissions';

export type ModuleMatrixOrigin = 'official' | 'modified';

export type RoleModuleAccessRow = ModuleAccessRow & { origin: ModuleMatrixOrigin };

export type RoleModuleMatrix = Record<ModuleId, RoleModuleAccessRow>;

function buildMatrixWithCheck(
  orgRole: OrganizationRole,
  roleHas: (permission: Permission) => boolean,
): Record<ModuleId, ModuleAccessRow> {
  const matrix = Object.fromEntries(MODULE_IDS.map((id) => [id, emptyModuleAccessRow(id)])) as Record<
    ModuleId,
    ModuleAccessRow
  >;
  for (const moduleId of MODULE_IDS) {
    const def = MODULE_CATALOG[moduleId];
    const row: ModuleAccessRow = {
      module: moduleId,
      canRead: isActionEffective(orgRole, moduleId, 'read', [], roleHas),
      canCreate: def.crud.create && isActionEffective(orgRole, moduleId, 'create', [], roleHas),
      canUpdate: def.crud.update && isActionEffective(orgRole, moduleId, 'update', [], roleHas),
      canDelete: def.crud.delete && isActionEffective(orgRole, moduleId, 'delete', [], roleHas),
      extras: def.specials
        .filter((s) => isSpecialEffective(orgRole, moduleId, s.id, [], roleHas))
        .map((s) => s.id),
    };
    matrix[moduleId] = normalizeModuleRow(row);
  }
  return matrix;
}

function rowDiffers(
  official: ModuleAccessRow,
  active: ModuleAccessRow,
): boolean {
  return (
    official.canRead !== active.canRead
    || official.canCreate !== active.canCreate
    || official.canUpdate !== active.canUpdate
    || official.canDelete !== active.canDelete
    || official.extras.join(',') !== active.extras.join(',')
  );
}

export function buildRoleModuleMatrix(
  role: OrganizationRole,
  map: OrganizationRolePermissionMap | null,
): RoleModuleMatrix {
  const activeCheck = createRolePermissionCheck(role, map);
  const officialCheck = createRolePermissionCheck(role, null);
  const active = buildMatrixWithCheck(role, activeCheck);
  const official = buildMatrixWithCheck(role, officialCheck);
  const out = {} as RoleModuleMatrix;
  for (const moduleId of MODULE_IDS) {
    const origin: ModuleMatrixOrigin = rowDiffers(official[moduleId], active[moduleId]) ? 'modified' : 'official';
    out[moduleId] = { ...active[moduleId], origin };
  }
  return out;
}

export function permissionsFromRoleModuleRows(rows: ModuleAccessRow[]): Permission[] {
  const set = new Set<Permission>();
  for (const row of rows) {
    for (const permission of permissionsFromModuleRow(row)) {
      set.add(permission);
    }
  }
  return [...set];
}

export function officialPermissionsMatchActive(
  role: OrganizationRole,
  active: ReadonlySet<Permission>,
): boolean {
  const official = officialPermissionSetForRole(role);
  if (official.size !== active.size) return false;
  for (const permission of official) {
    if (!active.has(permission)) return false;
  }
  return true;
}

export function moduleReadSummaryMatrix(
  roles: OrganizationRole[],
  map: OrganizationRolePermissionMap | null,
): Record<OrganizationRole, Record<ModuleId, boolean>> {
  const summary = {} as Record<OrganizationRole, Record<ModuleId, boolean>>;
  for (const role of roles) {
    const matrix = buildRoleModuleMatrix(role, map);
    summary[role] = Object.fromEntries(
      MODULE_IDS.map((id) => [id, matrix[id].canRead]),
    ) as Record<ModuleId, boolean>;
  }
  return summary;
}
