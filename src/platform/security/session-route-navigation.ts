import type { SessionRole } from '@/platform/security/authorization/session-roles';
import { routeToModule, ROUTE_PATH_TO_MODULE } from '@/platform/security/route-access';
import { ROUTE_ACCESS_BY_MODULE, type Module } from '@/platform/security/session-module-access';

export { ROUTE_PATH_TO_MODULE };

export function routeToAccess(pathname: string): { module: Module; roles: SessionRole[] | null } | null {
  const mod = routeToModule(pathname);
  if (!mod) return null;
  return { module: mod, roles: ROUTE_ACCESS_BY_MODULE[mod] };
}

export function canAccessRoute(role: SessionRole, pathname: string): boolean {
  const access = routeToAccess(pathname);
  if (!access) return false;
  if (!access.roles) return true;
  return access.roles.includes(role);
}
