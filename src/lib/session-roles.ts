/**
 * Edge-safe session/JWT role catalog.
 * Do not import Prisma, Node builtins, or authorization services here.
 */
export const SESSION_ROLES = [
  'ADMIN',
  'ADMINISTRACION',
  'SECRETARIA',
  'IT_MANAGER',
  'OWNER',
  'IT_TECHNICIAN',
  'PROCUREMENT',
  'HR',
  'AUDITOR',
  'USER',
  'DIRECTOR',
  'RRHH',
  'IT',
] as const;

export type SessionRole = (typeof SESSION_ROLES)[number];

export const VALID_SESSION_ROLES = new Set<string>(SESSION_ROLES);
