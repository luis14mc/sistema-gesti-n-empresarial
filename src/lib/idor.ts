// =====================================================
// IDOR Filter — Mitigación A01 OWASP
// Sprint 3: helper reusable para listas y objetos en APIs.
// Garantiza que rol USER solo vea recursos donde es dueño
// o donde está explícitamente autorizado (FK al user).
// =====================================================

import type { Prisma } from '@prisma/client';
import type { Role } from '@/types';

export interface IdorOptions {
  /** Rol del usuario actual (req.user.role) */
  role: Role;
  /** ID del usuario actual (req.user.userId) */
  userId: string;
  /**
   * Si es USER, este objeto describe cómo limitar el WHERE.
   *  - 'owner'         → filtra por `createdById = userId`
   *  - 'assigned'      → filtra por una relación "asignado a este userId"
   *  - 'self-record'   → el registro entero representa al userId (p.ej. TimeEntry)
   *  - 'none'          → USER no tiene acceso. NO incluirlo en PERMISSIONS.
   *  - { customWhere } → WHERE libre adicional en caso USER.
   */
  userAccess:
    | 'owner'
    | 'assigned'
    | 'self-record'
    | 'none'
    | { customWhere: Prisma.Args<unknown, 'findMany'>['where'] };
  /** Restricción WHERE para roles con menos de ADMIN: e.g. RRHH ve su depto */
  extraForStaff?: Record<Role, Prisma.Args<unknown, 'findMany'>['where'] | undefined>;
}

/**
 * Devuelve un objeto `where` Prisma que limita el resultado
 * según el rol del usuario actual. Úsalo en GET list / GET byId.
 *
 * Reglas:
 *  - ADMIN: sin restricción (todo)
 *  - USER : aplica userAccess (owner/assigned/self-record/custom)
 *  - Otros roles (IT, RRHH): sin restricción individual (RBAC granular
 *    ya limita en el endpoint via withAuth(allowedRoles) y canAccess)
 *
 * Para endpoints donde IT/RRHH ven TODO y USER ve solo lo propio,
 * extraForStaff puede añadir filtros específicos por rol (ej:
 * RRHH ve empleados de su departamento).
 *
 * Ejemplo:
 *   const where = applyIdorFilter(
 *     { isActive: true },
 *     { role: req.user!.role, userId: req.user!.userId,
 *       userAccess: 'assigned' }
 *   );
 */
export function applyIdorFilter<T extends Record<string, unknown>>(
  baseWhere: T,
  options: IdorOptions
): T | (T & { OR?: unknown; AND?: unknown }) {
  const { role, userId, userAccess, extraForStaff } = options;

  // Admin siempre ve todo
  if (role === 'ADMIN') {
    return baseWhere;
  }

  // Otros roles no-ADMIN con extraForStaff definido
  if (extraForStaff && extraForStaff[role]) {
    return { ...baseWhere, ...extraForStaff[role] } as T;
  }

  // USER: aplicar restricción estricta
  if (role === 'USER') {
    if (userAccess === 'none') {
      // Bloquear TODO el resultado
      return { ...baseWhere, id: '__never__' } as T & { id: string };
    }

    if (userAccess === 'self-record') {
      // El recurso tiene un campo userId directo (ej: TimeEntry)
      return { ...baseWhere, userId } as T & { userId: string };
    }

    if (userAccess === 'owner') {
      // Filtrar por createdById
      return { ...baseWhere, createdById: userId } as T & { createdById: string };
    }

    if (userAccess === 'assigned') {
      // Filtrar por una relación "asignado a este user" — combinación AND OR
      return {
        ...baseWhere,
        OR: [
          { userId },
          { assignedUserId: userId },
          { employee: { user: { id: userId } } },
        ],
      } as T & { OR: unknown[] };
    }

    if (typeof userAccess === 'object' && 'customWhere' in userAccess) {
      return { ...baseWhere, ...userAccess.customWhere } as T;
    }
  }

  return baseWhere;
}

/**
 * Valida que un único recurso sea accesible por el usuario actual.
 * Retorna true si pasa la verificación. Usar en GET /[id].
 *
 * Para 'owner':     item.userId === userId OR item.createdById === userId
 * Para 'assigned':  ver relaciones
 * Para 'self-record': item.userId === userId
 * Para 'custom':    el caller provee su propia función
 */
export function checkItemAccess(
  item: Record<string, unknown> | null | undefined,
  options: Omit<IdorOptions, 'extraForStaff'> & {
    customCheck?: (item: Record<string, unknown>) => boolean;
  }
): boolean {
  if (!item) return false;
  const { role, userId, userAccess, customCheck } = options;
  if (role === 'ADMIN') return true;

  if (customCheck) return customCheck(item);

  if (role === 'USER') {
    if (userAccess === 'none') return false;
    if (userAccess === 'self-record') return item.userId === userId;
    if (userAccess === 'owner') {
      return (
        (item as { userId?: string }).userId === userId ||
        (item as { createdById?: string }).createdById === userId ||
        (item as { employee?: { userId?: string } }).employee?.userId === userId
      );
    }
    if (userAccess === 'assigned') {
      return (
        (item as { userId?: string }).userId === userId ||
        (item as { assignedUserId?: string }).assignedUserId === userId
      );
    }
  }

  // IT/RRHH acceden si están en allowedRoles (controlado en el route handler)
  return true;
}
