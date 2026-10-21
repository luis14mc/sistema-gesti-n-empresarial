import type { SessionRole } from '@/platform/security/authorization/session-roles';
import type { ModuleId } from '@/platform/security/modules';

/** Legacy UI module id (aligned with {@link ModuleId}). */
export type Module = ModuleId;

export type Action = 'read' | 'create' | 'update' | 'delete';

type Role = SessionRole;

const FULL_ADMIN: Partial<Record<Module, Action[]>> = {
  dashboard: ['read'],
  oficios: ['read', 'create', 'update', 'delete'],
  equipment: ['read', 'create', 'update', 'delete'],
  assignments: ['read', 'create', 'update', 'delete'],
  employees: ['read', 'create', 'update', 'delete'],
  purchases: ['read', 'create', 'update', 'delete'],
  users: ['read', 'create', 'update', 'delete'],
  audits: ['read', 'create', 'update', 'delete'],
  'audit-records': ['read', 'create', 'update', 'delete'],
  reports: ['read'],
  settings: ['read', 'update'],
  'software-licenses': ['read', 'create', 'update', 'delete'],
  payroll: ['read', 'create', 'update'],
};

const TI: Partial<Record<Module, Action[]>> = {
  dashboard: ['read'],
  equipment: ['read', 'create', 'update', 'delete'],
  assignments: ['read', 'create', 'update', 'delete'],
  users: ['read', 'create', 'update', 'delete'],
  audits: ['read'],
  'audit-records': ['read'],
  reports: ['read'],
  settings: ['read', 'update'],
  'software-licenses': ['read', 'create', 'update', 'delete'],
};

const PERMISSIONS: Record<Role, Partial<Record<Module, Action[]>>> = {
  ADMIN: FULL_ADMIN,
  OWNER: FULL_ADMIN,
  ADMINISTRACION: {
    dashboard: ['read'],
    oficios: ['read', 'create', 'update', 'delete'],
    purchases: ['read', 'create', 'update', 'delete'],
    employees: ['read', 'create', 'update', 'delete'],
    reports: ['read'],
  },
  SECRETARIA: {
    oficios: ['read', 'create', 'update', 'delete'],
  },
  IT_MANAGER: TI,
  IT: TI,
  IT_TECHNICIAN: {
    dashboard: ['read'],
    equipment: ['read', 'create', 'update'],
    assignments: ['read', 'create', 'update'],
    reports: ['read'],
  },
  PROCUREMENT: {
    dashboard: ['read'],
    purchases: ['read', 'create', 'update', 'delete'],
    reports: ['read'],
  },
  HR: {
    dashboard: ['read'],
    users: ['read', 'create', 'update'],
    employees: ['read', 'create', 'update'],
    payroll: ['read', 'create', 'update'],
    oficios: ['read', 'create', 'update'],
    reports: ['read'],
  },
  RRHH: {
    dashboard: ['read'],
    users: ['read', 'create', 'update'],
    employees: ['read', 'create', 'update'],
    payroll: ['read', 'create', 'update'],
    oficios: ['read', 'create', 'update'],
    purchases: ['read', 'create'],
    reports: ['read'],
  },
  AUDITOR: {
    dashboard: ['read'],
    audits: ['read'],
    'audit-records': ['read'],
    equipment: ['read'],
    purchases: ['read'],
    reports: ['read'],
  },
  USER: {
    dashboard: ['read'],
    oficios: ['read'],
    equipment: ['read'],
    assignments: ['read'],
  },
  DIRECTOR: {
    dashboard: ['read'],
    reports: ['read'],
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

/** Legacy allow-list used when JWT has no `mod` claim (Edge middleware fallback). */
export const ROUTE_ACCESS_BY_MODULE: Record<Module, Role[] | null> = {
  dashboard: ['ADMIN', 'OWNER', 'ADMINISTRACION', 'IT_MANAGER', 'IT', 'IT_TECHNICIAN', 'PROCUREMENT', 'HR', 'RRHH', 'AUDITOR', 'USER', 'DIRECTOR'],
  oficios: ['ADMIN', 'OWNER', 'ADMINISTRACION', 'SECRETARIA', 'USER', 'HR', 'RRHH', 'PROCUREMENT'],
  equipment: ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT', 'IT_TECHNICIAN', 'AUDITOR', 'USER'],
  assignments: ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT', 'IT_TECHNICIAN', 'USER'],
  employees: ['ADMIN', 'OWNER', 'ADMINISTRACION', 'HR', 'RRHH'],
  purchases: ['ADMIN', 'OWNER', 'ADMINISTRACION', 'PROCUREMENT', 'RRHH', 'AUDITOR'],
  users: ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT', 'HR', 'RRHH'],
  audits: ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT', 'AUDITOR'],
  'audit-records': ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT', 'AUDITOR'],
  reports: ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT', 'IT_TECHNICIAN', 'PROCUREMENT', 'HR', 'RRHH', 'AUDITOR', 'DIRECTOR', 'ADMINISTRACION'],
  settings: ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT'],
  'software-licenses': ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT'],
  payroll: ['ADMIN', 'OWNER', 'HR', 'RRHH'],
};
