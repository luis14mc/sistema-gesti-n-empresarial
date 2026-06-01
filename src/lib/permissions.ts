import { type Role } from '@/types';

// ============================================
// RBAC — Permisos basados en rol
// Roles: ADMIN, USER, RRHH, IT
// ============================================

export type Module =
  | 'dashboard'
  | 'tickets'
  | 'oficios'
  | 'equipment'
  | 'inventory'
  | 'time-entries'
  | 'assignments'
  | 'users'
  | 'purchases'
  | 'audit-records'
  | 'settings';

export type Action = 'read' | 'create' | 'update' | 'delete';

const PERMISSIONS: Record<Role, Partial<Record<Module, Action[]>>> = {
  ADMIN: {
    dashboard:       ['read'],
    tickets:         ['read', 'create', 'update', 'delete'],
    oficios:         ['read', 'create', 'update', 'delete'],
    equipment:       ['read', 'create', 'update', 'delete'],
    inventory:       ['read', 'create', 'update', 'delete'],
    'time-entries':  ['read', 'create'],
    assignments:     ['read', 'create', 'update', 'delete'],
    users:           ['read', 'create', 'update', 'delete'],
    purchases:       ['read', 'create', 'update', 'delete'],
    'audit-records': ['read', 'create', 'update', 'delete'],
    settings:        ['read', 'update'],
  },

  IT: {
    dashboard:       ['read'],
    tickets:         ['read', 'create', 'update'],
    equipment:       ['read', 'create', 'update'],
    assignments:     ['read', 'create', 'update'],
    'time-entries':  ['read', 'create'],
    purchases:       ['read', 'create'],
    'audit-records': ['read'],
  },

  RRHH: {
    dashboard:       ['read'],
    users:           ['read', 'create', 'update'],
    oficios:         ['read', 'create', 'update'],
    'time-entries':  ['read', 'create'],
    inventory:       ['read', 'create', 'update'],
    purchases:       ['read', 'create'],
    'audit-records': ['read'],
  },

  USER: {
    dashboard:       ['read'],
    tickets:         ['read', 'create'],
    oficios:         ['read'],
    'time-entries':  ['read', 'create'],
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
