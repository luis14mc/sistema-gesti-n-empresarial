import type { Permission } from '@/platform/security/authorization/permissions';

export type RouteSpecialRequirement = {
  pathPrefix: string;
  requiredSpecial: Permission;
};

/** Path-prefix rules evaluated after module access (longest prefix wins). */
export const ROUTE_SPECIAL_REQUIREMENTS: readonly RouteSpecialRequirement[] = [
  { pathPrefix: '/settings/roles', requiredSpecial: 'roles.manage' },
];

export function requiredSpecialForPath(pathname: string): Permission | null {
  let match: RouteSpecialRequirement | null = null;
  for (const rule of ROUTE_SPECIAL_REQUIREMENTS) {
    if (pathname === rule.pathPrefix || pathname.startsWith(`${rule.pathPrefix}/`)) {
      if (!match || rule.pathPrefix.length > match.pathPrefix.length) {
        match = rule;
      }
    }
  }
  return match?.requiredSpecial ?? null;
}
