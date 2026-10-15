import type { Permission } from '@/platform/security/authorization/permissions';

/** Special permissions encoded in JWT for Edge middleware route gates (keep list small). */
export const JWT_ROUTE_SPECIALS = ['roles.manage', 'payroll.configure'] as const satisfies readonly Permission[];

export type JwtRouteSpecial = (typeof JWT_ROUTE_SPECIALS)[number];

export function encodeRouteSpecialsForJwt(granted: readonly Permission[]): string {
  const set = new Set(granted);
  return JWT_ROUTE_SPECIALS.filter((p) => set.has(p)).join(',');
}

export function decodeRouteSpecialsFromJwt(encoded: string | undefined): Set<Permission> {
  if (!encoded) return new Set();
  const allowed = new Set<string>(JWT_ROUTE_SPECIALS);
  return new Set(
    encoded
      .split(',')
      .filter((p) => p.length > 0 && allowed.has(p))
      .map((p) => p as Permission),
  );
}
