import type { ModuleId } from '@/platform/security/modules';

export const ROUTE_PATH_TO_MODULE: Record<string, ModuleId> = {
  '/dashboard': 'dashboard',
  '/oficios': 'oficios',
  '/oficios/todos': 'oficios',
  '/oficios/internos': 'oficios',
  '/oficios/cni': 'oficios',
  '/oficios/despacho': 'oficios',
  '/oficios/entradas': 'oficios',
  '/oficios/salidas': 'oficios',
  '/oficios/importar': 'oficios',
  '/settings/correspondencia': 'settings',
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
  '/reportes': 'reports',
  '/settings': 'settings',
  '/settings/permisos': 'users',
  '/ti/licencias': 'software-licenses',
  '/planilla': 'payroll',
  '/planilla/historico': 'payroll',
  '/planilla/empleados': 'payroll',
  '/planilla/configuracion': 'payroll',
};

export function routeToModule(pathname: string): ModuleId | null {
  if (pathname in ROUTE_PATH_TO_MODULE) {
    return ROUTE_PATH_TO_MODULE[pathname];
  }
  for (const [prefix, mod] of Object.entries(ROUTE_PATH_TO_MODULE)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return mod;
    }
  }
  return null;
}

export function routeToAccess(pathname: string): { module: ModuleId } | null {
  const mod = routeToModule(pathname);
  if (!mod) return null;
  return { module: mod };
}
