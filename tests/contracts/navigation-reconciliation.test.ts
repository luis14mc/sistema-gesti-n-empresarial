import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NAV_ITEMS, type NavItem } from '@/components/layout/nav-items';
import { hasModuleAccess } from '@/lib/permissions';
import type { Module } from '@/lib/permissions';
import type { Role } from '@/types';

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

// Mirror of the sidebar visibility logic (MainLayout).
function visibleChildModules(role: Role, item: NavItem): Module[] {
  if (!item.children?.length) return [];
  return item.children
    .map((c) => c.module ?? item.module)
    .filter((m) => hasModuleAccess(role, m));
}
function isItemVisible(role: Role, item: NavItem): boolean {
  return item.children?.length
    ? visibleChildModules(role, item).length > 0
    : hasModuleAccess(role, item.module);
}
/** All modules a role can actually reach through the rendered sidebar. */
function reachableModules(role: Role): Module[] {
  const mods = new Set<Module>();
  for (const item of NAV_ITEMS) {
    if (!isItemVisible(role, item)) continue;
    if (item.children?.length) {
      for (const m of visibleChildModules(role, item)) mods.add(m);
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
    for (const m of ['dashboard', 'oficios', 'equipment', 'employees', 'assignments', 'purchases', 'users', 'audit-records', 'settings'] as Module[]) {
      expect(modules).toContain(m);
    }
  });

  it('does NOT expose foundation-only / disabled capabilities', () => {
    const hrefs = allHrefs().join(' ');
    // Notifications, integrations, platform/org admin, institutional audits.
    expect(hrefs).not.toMatch(/\/notifications/);
    expect(hrefs).not.toMatch(/\/integrations/);
    expect(hrefs).not.toMatch(/\/platform/);
    expect(hrefs).not.toMatch(/\/organizations?\/admin/);
    // Institutional Audits page is /audits ; the system audit log is /audit/logs.
    // Ensure no nav entry points at the (disabled) institutional audits module.
    for (const href of allHrefs()) {
      expect(href === '/audits' || href.startsWith('/audits/')).toBe(false);
    }
  });

  it('contains no dead legacy purchase navigation', () => {
    const hrefs = allHrefs();
    expect(hrefs).not.toContain('/purchases');
    for (const href of hrefs) expect(href.startsWith('/purchases')).toBe(false);
  });

  it('permissions still filter the navigation per role (incl. per-child gating)', () => {
    const admin = reachableModules('ADMIN');
    expect(admin).toContain('users');
    expect(admin).toContain('settings');
    expect(admin).toContain('assignments');

    // A plain USER must not reach the Usuarios (users) admin module.
    const user = reachableModules('USER');
    expect(user).not.toContain('users');
    expect(user).not.toContain('settings');
    // But should still see their operational basics.
    expect(user).toContain('dashboard');
    expect(user).toContain('oficios');
  });
});
