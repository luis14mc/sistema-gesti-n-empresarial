import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NAV_ITEMS, type NavItem, type NavSubItem } from '@/components/layout/nav-items';
import { hasModuleAccess } from '@/platform/security/session-module-access';
import type { Module } from '@/platform/security/session-module-access';
import type { Role } from '@/types';
import {
  buildEffectiveModuleMatrix,
  moduleIdsWithRead,
  organizationRoleForSessionRole,
} from '@/platform/security/module-effective';
import { createRolePermissionCheck } from '@/platform/security/authorization/role-permission-service';

/**
 * Phase 14A — Navigation reconciliation guards (institutional IA).
 * The sidebar must expose only ACTIVE, operational modules. Foundation-only /
 * disabled capabilities must never appear, and every visible href must resolve
 * to a real page. Permissions must still filter the tree per role, including
 * per-child module gating within a group.
 */

const ROOT = resolve(__dirname, '..', '..');

function allHrefs(): string[] {
  const hrefs: string[] = [];
  for (const item of NAV_ITEMS) {
    hrefs.push(item.href);
    for (const child of item.children ?? []) hrefs.push(child.href);
  }
  return hrefs;
}

/** Every module referenced anywhere in the tree (top-level + children). */
function allModules(): Module[] {
  const mods = new Set<Module>();
  for (const item of NAV_ITEMS) {
    mods.add(item.module);
    for (const child of item.children ?? []) mods.add(child.module ?? item.module);
  }
  return [...mods];
}

function navContextForRole(role: Role) {
  const orgRole = organizationRoleForSessionRole(role);
  const roleHas = createRolePermissionCheck(orgRole, null);
  const matrix = buildEffectiveModuleMatrix(orgRole, [], roleHas);
  return {
    role,
    modulesRead: moduleIdsWithRead(matrix) as Module[],
    moduleExtras: Object.fromEntries(
      Object.entries(matrix).map(([moduleId, row]) => [moduleId, row.extras]),
    ) as Partial<Record<Module, string[]>>,
  };
}

// Mirror of the sidebar visibility logic (MainLayout).
function canSeeNavChild(
  ctx: ReturnType<typeof navContextForRole>,
  child: NavSubItem,
  parentModule: Module,
): boolean {
  const mod = child.module ?? parentModule;
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

function visibleChildren(ctx: ReturnType<typeof navContextForRole>, item: NavItem): NavSubItem[] {
  if (!item.children?.length) return [];
  return item.children.filter((child) => canSeeNavChild(ctx, child, item.module));
}

function visibleChildModules(ctx: ReturnType<typeof navContextForRole>, item: NavItem): Module[] {
  return visibleChildren(ctx, item).map((c) => c.module ?? item.module);
}

function isItemVisible(ctx: ReturnType<typeof navContextForRole>, item: NavItem): boolean {
  return item.children?.length
    ? visibleChildren(ctx, item).length > 0
    : ctx.modulesRead.includes(item.module) || hasModuleAccess(ctx.role, item.module);
}

function visibleNavHrefs(role: Role): string[] {
  const ctx = navContextForRole(role);
  const hrefs: string[] = [];
  for (const item of NAV_ITEMS) {
    if (!isItemVisible(ctx, item)) continue;
    if (item.children?.length) {
      for (const child of visibleChildren(ctx, item)) hrefs.push(child.href);
    } else {
      hrefs.push(item.href);
    }
  }
  return hrefs;
}

function reachableModules(role: Role): Module[] {
  const ctx = navContextForRole(role);
  const mods = new Set<Module>();
  for (const item of NAV_ITEMS) {
    if (!isItemVisible(ctx, item)) continue;
    if (item.children?.length) {
      for (const m of visibleChildModules(ctx, item)) mods.add(m);
    } else {
      mods.add(item.module);
    }
  }
  return [...mods];
}

describe('navigation reconciliation', () => {
  it('every nav href resolves to a real page (no dead links)', () => {
    for (const href of allHrefs()) {
      const page = resolve(ROOT, `src/app${href}/page.tsx`);
      expect(existsSync(page), `missing page for ${href}`).toBe(true);
    }
  });

  it('exposes the expected ACTIVE modules (top-level or grouped)', () => {
    const modules = allModules();
    for (const m of ['dashboard', 'oficios', 'equipment', 'employees', 'assignments', 'purchases', 'users', 'reports', 'audit-records', 'settings'] as Module[]) {
      expect(modules).toContain(m);
    }
  });

  it('does NOT expose foundation-only / disabled capabilities', () => {
    const hrefs = allHrefs().join(' ');
    // Notifications, integrations, platform/org admin remain foundation-only.
    expect(hrefs).not.toMatch(/\/notifications/);
    expect(hrefs).not.toMatch(/\/integrations/);
    expect(hrefs).not.toMatch(/\/platform/);
    expect(hrefs).not.toMatch(/\/organizations?\/admin/);
    // Maintenance has no operational page yet (14F) — must not be linked.
    expect(hrefs).not.toMatch(/\/maintenance/);
  });

  it('exposes Institutional Audits gated by the ADMIN-only `audits` module', () => {
    const auditNav = NAV_ITEMS.flatMap((i) => i.children ?? []).find((c) => c.href === '/audits');
    expect(auditNav, 'institutional audits must be present in nav').toBeTruthy();
    expect(auditNav?.module).toBe('audits');
    // Only ADMIN reaches it.
    expect(reachableModules('ADMIN')).toContain('audits');
    expect(reachableModules('USER')).not.toContain('audits');
    expect(reachableModules('IT')).toContain('audits');
    expect(reachableModules('ADMINISTRACION')).not.toContain('audits');
    expect(reachableModules('SECRETARIA')).not.toContain('audits');
    expect(reachableModules('SECRETARIA')).toEqual(['oficios']);
  });

  it('contains no dead legacy purchase navigation', () => {
    const hrefs = allHrefs();
    expect(hrefs).not.toContain('/purchases');
    for (const href of hrefs) expect(href.startsWith('/purchases')).toBe(false);
  });

  it('Roles y permisos requires roles.manage (IT cannot see the link)', () => {
    const rolesNav = NAV_ITEMS.flatMap((i) => i.children ?? []).find(
      (c) => c.href === '/settings/roles',
    );
    expect(rolesNav?.requiredSpecial).toBe('roles.manage');
    expect(visibleNavHrefs('ADMIN')).toContain('/settings/roles');
    expect(visibleNavHrefs('OWNER')).toContain('/settings/roles');
    expect(visibleNavHrefs('IT')).not.toContain('/settings/roles');
  });

  it('lists Usuarios under Administración, not under Personas', () => {
    const personas = NAV_ITEMS.find((i) => i.label === 'Personas');
    expect(personas?.href).toBe('/employees');
    expect(personas?.children).toBeUndefined();

    const adminGroup = NAV_ITEMS.find((i) => i.label === 'Administración');
    const usersChild = adminGroup?.children?.find((c) => c.href === '/users');
    expect(usersChild, 'Usuarios must live under Administración').toBeTruthy();
    expect(usersChild?.module).toBe('users');

    const personasHrefs = personas?.children?.map((c) => c.href) ?? [personas?.href];
    expect(personasHrefs).not.toContain('/users');
  });

  it('permissions still filter the navigation per role (incl. per-child gating)', () => {
    const admin = reachableModules('ADMIN');
    expect(admin).toContain('users');
    expect(admin).toContain('settings');
    expect(admin).toContain('assignments');
    expect(admin).toContain('payroll');

    // A plain USER must not reach the Usuarios (users) admin module.
    const user = reachableModules('USER');
    expect(user).not.toContain('users');
    expect(user).not.toContain('settings');
    // But should still see their operational basics.
    expect(user).toContain('dashboard');
    expect(user).toContain('oficios');
  });
});
