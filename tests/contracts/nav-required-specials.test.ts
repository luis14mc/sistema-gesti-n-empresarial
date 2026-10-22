import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, type NavSubItem } from '@/components/layout/nav-items';
import {
  buildEffectiveModuleMatrix,
  isPermissionEffective,
  moduleIdsWithRead,
  organizationRoleForSessionRole,
} from '@/platform/security/module-effective';
import { createRolePermissionCheck } from '@/platform/security/authorization/role-permission-service';
import type { Permission, PermissionOverride } from '@/platform/security/authorization/permissions';
import { MODULE_CATALOG } from '@/platform/security/modules';
import type { Module } from '@/platform/security/session-module-access';
import type { Role } from '@/types';
import { hasModuleAccess } from '@/platform/security/session-module-access';
import { encodeRouteSpecialsForJwt, JWT_ROUTE_SPECIALS } from '@/platform/security/jwt-route-specials';

type NavAccessContext = {
  role: Role;
  modulesRead: Module[];
  moduleExtras: Partial<Record<Module, string[]>>;
};

function navContextForRole(role: Role, overrides: PermissionOverride[] = []): NavAccessContext {
  const orgRole = organizationRoleForSessionRole(role);
  const roleHas = createRolePermissionCheck(orgRole, null);
  const matrix = buildEffectiveModuleMatrix(orgRole, overrides, roleHas);
  return {
    role,
    modulesRead: moduleIdsWithRead(matrix) as Module[],
    moduleExtras: Object.fromEntries(
      Object.entries(matrix).map(([moduleId, row]) => [moduleId, row.extras]),
    ) as Partial<Record<Module, string[]>>,
  };
}

function canSeeNavChild(ctx: NavAccessContext, child: NavSubItem, parentModule: Module): boolean {
  const mod = (child.module ?? parentModule) as Module;
  if (ctx.modulesRead.length) {
    if (!ctx.modulesRead.includes(mod)) return false;
  } else if (!hasModuleAccess(ctx.role, mod)) {
    return false;
  }
  if (child.requiredSpecial) {
    const extras = ctx.moduleExtras[mod] ?? [];
    return extras.includes(child.requiredSpecial);
  }
  return true;
}

function visibleNavHrefs(ctx: NavAccessContext): string[] {
  const hrefs: string[] = [];
  for (const item of NAV_ITEMS) {
    const children = item.children?.filter((child) => canSeeNavChild(ctx, child, item.module)) ?? [];
    if (item.children?.length) {
      if (children.length === 0) continue;
      for (const child of children) hrefs.push(child.href);
    } else if (canSeeNavChild(ctx, { label: item.label, href: item.href, module: item.module }, item.module)) {
      hrefs.push(item.href);
    }
  }
  return hrefs;
}

describe('nav requiredSpecial ↔ module catalog', () => {
  it('every requiredSpecial in nav-items exists as a special on the child module', () => {
    for (const item of NAV_ITEMS) {
      for (const child of item.children ?? []) {
        if (!child.requiredSpecial) continue;
        const mod = child.module ?? item.module;
        const specials = MODULE_CATALOG[mod].specials.map((s) => s.id);
        expect(
          specials,
          `${child.label} (${child.href}) requires ${child.requiredSpecial} on module ${mod}`,
        ).toContain(child.requiredSpecial);
      }
    }
  });
});

describe('Roles y permisos menu visibility (module extras)', () => {
  it('ADMIN and OWNER see Roles y permisos', () => {
    for (const role of ['ADMIN', 'OWNER'] as const) {
      const ctx = navContextForRole(role);
      expect(ctx.moduleExtras.settings).toContain('roles.manage');
      expect(visibleNavHrefs(ctx)).toContain('/settings/roles');
    }
  });

  it('IT does not see Roles y permisos without override', () => {
    const ctx = navContextForRole('IT');
    expect(ctx.moduleExtras.settings ?? []).not.toContain('roles.manage');
    expect(visibleNavHrefs(ctx)).not.toContain('/settings/roles');
  });

  it('IT with ALLOW override on roles.manage sees Roles y permisos', () => {
    const overrides: PermissionOverride[] = [{ permission: 'roles.manage', effect: 'ALLOW' }];
    const ctx = navContextForRole('IT', overrides);
    expect(ctx.moduleExtras.settings).toContain('roles.manage');
    expect(visibleNavHrefs(ctx)).toContain('/settings/roles');
  });

  it('effective matrix feeds JWT route specials for roles.manage', () => {
    const orgRole = organizationRoleForSessionRole('ADMIN');
    const roleHas = createRolePermissionCheck(orgRole, null);
    const matrix = buildEffectiveModuleMatrix(orgRole, [], roleHas);
    expect(matrix.settings.extras).toContain('roles.manage');

    const routeSpecials = JWT_ROUTE_SPECIALS.filter((permission) =>
      isPermissionEffective(orgRole, permission, [], roleHas),
    );
    expect(encodeRouteSpecialsForJwt(routeSpecials)).toContain('roles.manage');
  });
});
