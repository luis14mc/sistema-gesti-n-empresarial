import type { SessionRole } from '@/lib/session-roles';

type Role = SessionRole;

export type Module =
  | 'dashboard'
  | 'oficios'
  | 'equipment'
  | 'assignments'
  | 'employees'
  | 'users'
  | 'purchases'
  | 'audits'
  | 'audit-records'
  | 'settings';

export type Action = 'read' | 'create' | 'update' | 'delete';

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
  settings: ['read', 'update'],
};

const TI: Partial<Record<Module, Action[]>> = {
  dashboard: ['read'],
  equipment: ['read', 'create', 'update', 'delete'],
  assignments: ['read', 'create', 'update', 'delete'],
  users: ['read', 'create', 'update', 'delete'],
  audits: ['read'],
  'audit-records': ['read'],
  settings: ['read', 'update'],
};

const PERMISSIONS: Record<Role, Partial<Record<Module, Action[]>>> = {
  ADMIN: FULL_ADMIN,
  OWNER: FULL_ADMIN,
  ADMINISTRACION: {
    dashboard: ['read'],
    oficios: ['read', 'create', 'update', 'delete'],
    purchases: ['read', 'create', 'update', 'delete'],
    employees: ['read', 'create', 'update', 'delete'],
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
  },
  PROCUREMENT: {
    dashboard: ['read'],
    purchases: ['read', 'create', 'update', 'delete'],
  },
  HR: {
    dashboard: ['read'],
    users: ['read', 'create', 'update'],
    employees: ['read', 'create', 'update'],
    oficios: ['read', 'create', 'update'],
  },
  RRHH: {
    dashboard: ['read'],
    users: ['read', 'create', 'update'],
    employees: ['read', 'create', 'update'],
    oficios: ['read', 'create', 'update'],
    purchases: ['read', 'create'],
  },
  AUDITOR: {
    dashboard: ['read'],
    audits: ['read'],
    'audit-records': ['read'],
    equipment: ['read'],
    purchases: ['read'],
  },
  USER: {
    dashboard: ['read'],
    oficios: ['read'],
    equipment: ['read'],
    assignments: ['read'],
  },
  DIRECTOR: {
    dashboard: ['read'],
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
  settings: ['ADMIN', 'OWNER', 'IT_MANAGER', 'IT'],
};

export const ROUTE_PATH_TO_MODULE: Record<string, Module> = {
  '/dashboard': 'dashboard',
  '/oficios': 'oficios',
  '/oficios/todos': 'oficios',
  '/oficios/internos': 'oficios',
  '/oficios/cni': 'oficios',
  '/oficios/despacho': 'oficios',
  '/oficios/importar': 'oficios',
  '/equipment': 'equipment',
  '/equipment-disposal': 'equipment',
  '/assignments': 'assignments',
  '/employees': 'employees',
  '/purchases': 'purchases',
  '/compras': 'purchases',
  '/compras/solicitudes': 'purchases',
  '/compras/bandeja': 'purchases',
  '/compras/proveedores': 'purchases',
  '/compras/reportes': 'purchases',
  '/compras/nueva': 'purchases',
  '/compras/configuracion': 'purchases',
  '/users': 'users',
  '/audits': 'audits',
  '/audit/logs': 'audit-records',
  '/audit-records': 'audit-records',
  '/settings': 'settings',
};

export function routeToAccess(pathname: string): { module: Module; roles: Role[] | null } | null {
  if (pathname in ROUTE_PATH_TO_MODULE) {
    const mod = ROUTE_PATH_TO_MODULE[pathname];
    return { module: mod, roles: ROUTE_ACCESS_BY_MODULE[mod] };
  }
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
  if (!access.roles) return true;
  return access.roles.includes(role);
}
