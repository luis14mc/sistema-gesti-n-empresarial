import { type Role } from '@/types';

// ============================================
// RBAC — Permisos basados en rol
// Roles: ADMIN, USER, RRHH, IT
// Sprint 1: tickets/inventory/time-entries deprecados
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
