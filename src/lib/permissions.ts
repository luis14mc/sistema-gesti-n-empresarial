import { type Role } from '@/types';

// ============================================
// RBAC — Permisos basados en rol
// Roles: ADMIN, USER, RRHH, IT
// Sprint 1: tickets/inventory/time-entries deprecados
// Sprint 2: ROUTE_ACCESS_BY_MODULE añadido como única fuente para rutas
// ============================================

export type Module =
  | 'dashboard'
  | 'oficios'
  | 'equipment'
  | 'assignments'
  | 'employees'
  | 'users'
  | 'purchases'
  | 'audit-records'
  | 'settings';

export type Action = 'read' | 'create' | 'update' | 'delete';

const PERMISSIONS: Record<Role, Partial<Record<Module, Action[]>>> = {
  ADMIN: {
    dashboard:       ['read'],
    oficios:         ['read', 'create', 'update', 'delete'],
    equipment:       ['read', 'create', 'update', 'delete'],
    assignments:     ['read', 'create', 'update', 'delete'],
    employees:       ['read', 'create', 'update', 'delete'],
    purchases:       ['read', 'create', 'update', 'delete'],
    users:           ['read', 'create', 'update', 'delete'],
    'audit-records': ['read', 'create', 'update', 'delete'],
    settings:        ['read', 'update'],
  },

  IT: {
    dashboard:       ['read'],
    equipment:       ['read', 'create', 'update'],
    assignments:     ['read', 'create', 'update'],
    employees:       ['read', 'create', 'update'],
    purchases:       ['read', 'create'],
    'audit-records': ['read'],
  },

  RRHH: {
    dashboard:       ['read'],
    users:           ['read', 'create', 'update'],
    employees:       ['read', 'create', 'update'],
    oficios:         ['read', 'create', 'update'],
    purchases:       ['read', 'create'],
    'audit-records': ['read'],
  },

  USER: {
    dashboard:       ['read'],
    oficios:         ['read'],
    equipment:       ['read'],
    assignments:     ['read'],
  },
};

export function canAccess(role: Role, module: Module, action: Action = 'read'): boolean {
  const modulePerms = PERMISSIONS[role]?.[module];
  if (!modulePerms) return false;
  return modulePerms.includes(action);
}

export function hasModuleAccess(role: Role, module: Module): boolean {
  return !!PERMISSIONS[role]?.[module];
}

export function getAccessibleModules(role: Role): Module[] {
  const perms = PERMISSIONS[role];
  if (!perms) return [];
  return Object.keys(perms) as Module[];
}

export function getModuleActions(role: Role, module: Module): Action[] {
  return PERMISSIONS[role]?.[module] ?? [];
}

// =====================================================
// RBAC por ruta URL — única fuente de verdad compartida
// por middleware (Edge) y por el sidebar (cliente).
// =====================================================

/**
 * Path raíz por módulo. El middleware matchea por prefijo.
 * null = cualquier rol autenticado.
 */
export const ROUTE_ACCESS_BY_MODULE: Record<Module, Role[] | null> = {
  'dashboard':       null,
  'oficios':         null,
  'equipment':       null,
  'assignments':     ['ADMIN', 'IT'],
  'employees':       ['ADMIN', 'IT', 'RRHH'],
  'purchases':       ['ADMIN', 'IT', 'RRHH'],
  'users':           ['ADMIN', 'RRHH'],
  'audit-records':   ['ADMIN'],
  'settings':        ['ADMIN'],
};

/** Mapa URL explicitado para el middleware (sin acoplar módulos↔paths). */
export const ROUTE_PATH_TO_MODULE: Record<string, Module> = {
  '/dashboard':      'dashboard',
  '/oficios':        'oficios',
  '/equipment':      'equipment',
  '/assignments':    'assignments',
  '/employees':      'employees',
  '/purchases':      'purchases',
  '/users':          'users',
  '/audit/logs':     'audit-records',
  '/audit-records':  'audit-records',
  '/settings':       'settings',
};

/**
 * Resuelve el módulo para una ruta y roles permitidos.
 * Retorna null si la ruta no es protegida.
 */
export function routeToAccess(pathname: string): { module: Module; roles: Role[] | null } | null {
  // Match exacto primero
  if (pathname in ROUTE_PATH_TO_MODULE) {
    const mod = ROUTE_PATH_TO_MODULE[pathname];
    return { module: mod, roles: ROUTE_ACCESS_BY_MODULE[mod] };
  }
  // Match por prefijo (para subrutas /equipos/[id])
  for (const [prefix, mod] of Object.entries(ROUTE_PATH_TO_MODULE)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return { module: mod, roles: ROUTE_ACCESS_BY_MODULE[mod] };
    }
  }
  return null;
}

export function canAccessRoute(role: Role, pathname: string): boolean {
  const access = routeToAccess(pathname);
  if (!access) return false;
  if (!access.roles) return true; // cualquier autenticado
  return access.roles.includes(role);
}
