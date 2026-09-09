import type { OrganizationRole, Role as PrismaUserRole } from '@prisma/client';
import { VALID_SESSION_ROLES, type SessionRole } from '@/lib/session-roles';

export { SESSION_ROLES, VALID_SESSION_ROLES } from '@/lib/session-roles';
export type { SessionRole };

/**
 * Promoted CNI operating profiles. These are the only organization roles
 * offered in the normal user-management UI.
 */
export const PROMOTED_ORGANIZATION_ROLES = [
  'ADMIN',
  'ADMINISTRACION',
  'SECRETARIA',
  'IT_MANAGER',
] as const satisfies readonly OrganizationRole[];

export type PromotedOrganizationRole = (typeof PROMOTED_ORGANIZATION_ROLES)[number];

/**
 * Legacy OrganizationRole values kept for backward compatibility.
 * Do not assign these through the normal user-management UI.
 */
export const LEGACY_ORGANIZATION_ROLES = [
  'OWNER',
  'IT_TECHNICIAN',
  'PROCUREMENT',
  'HR',
  'AUDITOR',
  'USER',
  'DIRECTOR',
] as const satisfies readonly OrganizationRole[];

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  ADMIN: 'Super Admin',
  ADMINISTRACION: 'Administrativo',
  SECRETARIA: 'Correspondencia',
  IT_MANAGER: 'TI',
  OWNER: 'Propietario (legado)',
  IT_TECHNICIAN: 'Técnico TI (legado)',
  PROCUREMENT: 'Compras (legado)',
  HR: 'Recursos Humanos (legado)',
  AUDITOR: 'Auditor (legado)',
  USER: 'Usuario (legado)',
  DIRECTOR: 'Director (legado)',
};

/** Legacy JWT / User.role enum values that are not OrganizationRole members. */
export const LEGACY_JWT_USER_ROLES = ['RRHH', 'IT'] as const;

export type LegacyJwtUserRole = (typeof LEGACY_JWT_USER_ROLES)[number];

export function isPromotedOrganizationRole(role: string): role is PromotedOrganizationRole {
  return (PROMOTED_ORGANIZATION_ROLES as readonly string[]).includes(role);
}

export function isSessionRole(role: string): role is SessionRole {
  return VALID_SESSION_ROLES.has(role);
}

/**
 * JWT session roles may be OrganizationRole values while some route handlers
 * still use leftover User.role allowlists (`IT`, `ADMIN`). Map only the
 * aliases required so TI keeps equipment access after login.
 * Do not map ADMINISTRACION → RRHH (that would grant audit writes).
 */
export function sessionRoleMatchesAllowlist(
  sessionRole: string,
  allowedRoles: readonly string[],
): boolean {
  if (allowedRoles.includes(sessionRole)) return true;
  if (sessionRole === 'IT_MANAGER' && allowedRoles.includes('IT')) return true;
  if (sessionRole === 'OWNER' && allowedRoles.includes('ADMIN')) return true;
  return false;
}

export function organizationRoleLabel(role: string): string {
  if (role in ORGANIZATION_ROLE_LABELS) {
    return ORGANIZATION_ROLE_LABELS[role as OrganizationRole];
  }
  if (role === 'RRHH') return ORGANIZATION_ROLE_LABELS.HR;
  if (role === 'IT') return ORGANIZATION_ROLE_LABELS.IT_MANAGER;
  return role;
}

/** Maps a CNI profile to the persisted Prisma `User.role` enum (no migration). */
export function toPrismaUserRole(role: PromotedOrganizationRole): PrismaUserRole {
  switch (role) {
    case 'ADMIN':
      return 'ADMIN';
    case 'ADMINISTRACION':
      return 'RRHH';
    case 'SECRETARIA':
      return 'USER';
    case 'IT_MANAGER':
      return 'IT';
  }
}

export function fromPrismaUserRole(role: PrismaUserRole): SessionRole {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'IT') return 'IT';
  if (role === 'RRHH') return 'RRHH';
  return 'USER';
}

/** Landing path after login. Correspondencia has no dashboard entitlement. */
export function postLoginPath(role: string): string {
  return role === 'SECRETARIA' ? '/oficios/todos' : '/dashboard';
}
