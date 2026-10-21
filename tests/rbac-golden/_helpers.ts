import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ORGANIZATION_PERMISSIONS,
  ORGANIZATION_ROLES,
  organizationRole,
  can,
  type OrganizationRole,
  type Permission,
} from '@/platform/security/authorization/permissions';
import { lockedPermissionsForRole } from '@/platform/security/authorization/role-permission-locks';
import { ROUTE_PATH_TO_MODULE as LIB_ROUTE_PATH_TO_MODULE, canAccessRoute } from '@/lib/permissions';
import {
  ROUTE_PATH_TO_MODULE as PLATFORM_ROUTE_PATH_TO_MODULE,
  routeToAccess as platformRouteToAccess,
} from '@/platform/security/route-access';
import { SESSION_ROLES, type SessionRole } from '@/platform/security/authorization/session-roles';

export type OfficialMatrixRow = {
  role: OrganizationRole;
  permission: Permission;
  officialGranted: boolean;
  locked: boolean;
};

export function buildOfficialMatrix(): OfficialMatrixRow[] {
  const rows: OfficialMatrixRow[] = [];
  for (const role of ORGANIZATION_ROLES) {
    const locked = new Set(lockedPermissionsForRole(role));
    for (const permission of ORGANIZATION_PERMISSIONS) {
      rows.push({
        role,
        permission,
        officialGranted: can(organizationRole(role), permission),
        locked: locked.has(permission),
      });
    }
  }
  return rows.sort((a, b) =>
    a.role === b.role ? a.permission.localeCompare(b.permission) : a.role.localeCompare(b.role),
  );
}

function pageFileToPathname(appRoot: string, pageFile: string): string {
  const rel = relative(appRoot, pageFile).replace(/\\/g, '/');
  const withoutPage = rel.replace(/\/page\.tsx$/, '');
  const segments = withoutPage
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith('[') && seg.endsWith(']') ? 'x' : seg));
  return segments.length ? `/${segments.join('/')}` : '/';
}

function walkPageFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkPageFiles(full, acc);
    else if (name === 'page.tsx') acc.push(full);
  }
  return acc;
}

export function collectAppPathnames(appDir = join(process.cwd(), 'src/app')): string[] {
  const pages = walkPageFiles(appDir);
  const pathnames = pages.map((p) => pageFileToPathname(appDir, p));
  return [...new Set(pathnames)].sort();
}

export type RouteMapRow = {
  pathname: string;
  libModule: string | null;
  platformModule: string | null;
  requiredSpecial: string | null;
  mismatch: boolean;
  canAccessRoute: Record<SessionRole, boolean>;
};

export function buildRouteMap(): RouteMapRow[] {
  const pathnames = new Set<string>([
    ...Object.keys(LIB_ROUTE_PATH_TO_MODULE),
    ...Object.keys(PLATFORM_ROUTE_PATH_TO_MODULE),
    ...collectAppPathnames(),
  ]);

  const rows: RouteMapRow[] = [];
  for (const pathname of [...pathnames].sort()) {
    const libModule = pathname in LIB_ROUTE_PATH_TO_MODULE
      ? LIB_ROUTE_PATH_TO_MODULE[pathname]
      : resolveLibModuleByPrefix(pathname);
    const platformAccess = platformRouteToAccess(pathname);
    const platformModule = platformAccess?.module ?? null;
    const requiredSpecial = platformAccess?.requiredSpecial ?? null;

    const canAccessRouteByRole = {} as Record<SessionRole, boolean>;
    for (const role of SESSION_ROLES) {
      canAccessRouteByRole[role] = canAccessRoute(role, pathname);
    }

    rows.push({
      pathname,
      libModule,
      platformModule,
      requiredSpecial,
      mismatch: libModule !== platformModule,
      canAccessRoute: canAccessRouteByRole,
    });
  }
  return rows;
}

function resolveLibModuleByPrefix(pathname: string): string | null {
  if (pathname in LIB_ROUTE_PATH_TO_MODULE) return LIB_ROUTE_PATH_TO_MODULE[pathname];
  for (const [prefix, mod] of Object.entries(LIB_ROUTE_PATH_TO_MODULE)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return mod;
  }
  return null;
}
