import type { Permission } from '@/platform/security/authorization/permissions';

export type ModuleId =
  | 'dashboard'
  | 'oficios'
  | 'equipment'
  | 'assignments'
  | 'employees'
  | 'users'
  | 'purchases'
  | 'audits'
  | 'audit-records'
  | 'reports'
  | 'settings'
  | 'software-licenses'
  | 'payroll';

export type ModuleAction = 'read' | 'create' | 'update' | 'delete';

export type ModuleSpecial = {
  id: Permission;
  label: string;
};

export type ModuleDefinition = {
  id: ModuleId;
  label: string;
  navGroup?: string;
  sensitive?: boolean;
  /** Which CRUD columns apply in the matrix UI. */
  crud: Record<ModuleAction, boolean>;
  /** Fine-grained permissions granted by each CRUD flag. */
  permissionMap: Partial<Record<ModuleAction, readonly Permission[]>>;
  specials: readonly ModuleSpecial[];
};

const PO_READ = ['purchase-orders.read', 'purchase-orders.download', 'suppliers.read'] as const;
const PO_WRITE = ['purchase-orders.create', 'purchase-orders.update', 'purchase-orders.generate', 'purchase-orders.cancel', 'suppliers.create', 'suppliers.update'] as const;

export const MODULE_CATALOG: Record<ModuleId, ModuleDefinition> = {
  dashboard: {
    id: 'dashboard',
    label: 'Inicio',
    crud: { read: true, create: false, update: false, delete: false },
    permissionMap: { read: ['dashboard.view'] },
    specials: [],
  },
  oficios: {
    id: 'oficios',
    label: 'Correspondencia',
    crud: { read: true, create: true, update: true, delete: true },
    permissionMap: {
      read: ['oficios.read', 'oficios.export', 'oficios.attachments', 'oficios.import'],
      create: ['oficios.create'],
      update: ['oficios.update', 'oficios.configure'],
      delete: ['oficios.deactivate'],
    },
    specials: [{ id: 'oficios.configure', label: 'Configurar numeración' }],
  },
  equipment: {
    id: 'equipment',
    label: 'Equipos',
    crud: { read: true, create: true, update: true, delete: true },
    permissionMap: {
      read: ['equipment.read', 'equipment-disposal.read', 'equipment-disposal.download'],
      create: ['equipment.create', 'equipment-disposal.create'],
      update: ['equipment.update', 'equipment.assign', 'equipment.maintain', 'equipment-disposal.update', 'equipment-disposal.submit'],
      delete: ['equipment.dispose'],
    },
    specials: [
      { id: 'equipment-disposal.approve', label: 'Aprobar bajas' },
      { id: 'equipment-disposal.configure', label: 'Configurar bajas' },
    ],
  },
  assignments: {
    id: 'assignments',
    label: 'Asignaciones',
    crud: { read: true, create: true, update: true, delete: false },
    permissionMap: {
      read: ['equipment.read'],
      create: ['equipment.assign'],
      update: ['equipment.assign'],
      delete: [],
    },
    specials: [],
  },
  employees: {
    id: 'employees',
    label: 'Empleados',
    crud: { read: true, create: true, update: true, delete: true },
    permissionMap: {
      read: ['employees.read'],
      create: ['employees.create'],
      update: ['employees.update'],
      delete: ['employees.deactivate'],
    },
    specials: [],
  },
  users: {
    id: 'users',
    label: 'Usuarios',
    crud: { read: true, create: true, update: true, delete: true },
    permissionMap: {
      read: ['users.read'],
      create: ['users.create'],
      update: ['users.update', 'memberships.manage'],
      delete: ['users.deactivate'],
    },
    specials: [],
  },
  purchases: {
    id: 'purchases',
    label: 'Compras',
    crud: { read: true, create: true, update: true, delete: true },
    permissionMap: {
      read: [...PO_READ],
      create: [...PO_WRITE],
      update: [...PO_WRITE],
      delete: ['purchase-orders.cancel'],
    },
    specials: [{ id: 'purchase-orders.approve', label: 'Aprobar órdenes' }],
  },
  audits: {
    id: 'audits',
    label: 'Auditoría institucional',
    crud: { read: true, create: true, update: true, delete: false },
    permissionMap: {
      read: ['audit.read'],
      create: ['audit.read'],
      update: ['audit.read'],
      delete: [],
    },
    specials: [],
  },
  'audit-records': {
    id: 'audit-records',
    label: 'Auditoría del sistema',
    crud: { read: true, create: false, update: false, delete: false },
    permissionMap: { read: ['audit.read'] },
    specials: [],
  },
  reports: {
    id: 'reports',
    label: 'Reportes',
    crud: { read: true, create: false, update: false, delete: false },
    permissionMap: { read: ['reports.view', 'reports.export', 'dashboard.view'] },
    specials: [
      { id: 'reports.financial', label: 'Reportes financieros' },
      { id: 'reports.audit', label: 'Reportes de auditoría' },
    ],
  },
  settings: {
    id: 'settings',
    label: 'Administración',
    crud: { read: true, create: false, update: true, delete: false },
    permissionMap: {
      read: ['integrations.read', 'oficios.configure', 'roles.manage'],
      update: ['oficios.configure', 'integrations.read', 'roles.manage'],
    },
    specials: [],
  },
  'software-licenses': {
    id: 'software-licenses',
    label: 'Licencias',
    crud: { read: true, create: true, update: true, delete: false },
    permissionMap: {
      read: ['software-licenses.read', 'software-licenses.export'],
      create: ['software-licenses.create'],
      update: ['software-licenses.update', 'software-licenses.assign', 'software-licenses.manage'],
      delete: [],
    },
    specials: [],
  },
  payroll: {
    id: 'payroll',
    label: 'Planilla',
    sensitive: true,
    crud: { read: true, create: true, update: true, delete: false },
    permissionMap: {
      read: ['payroll.view'],
      create: ['payroll.generate'],
      update: ['payroll.generate'],
      delete: [],
    },
    specials: [{ id: 'payroll.configure', label: 'Configurar planilla (ISR/IHSS)' }],
  },
};

export const MODULE_IDS = Object.keys(MODULE_CATALOG) as ModuleId[];

export type ModuleAccessRow = {
  module: ModuleId;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  extras: string[];
};

export type EffectiveModuleAccess = Record<ModuleId, ModuleAccessRow>;

export function emptyModuleAccessRow(module: ModuleId): ModuleAccessRow {
  return {
    module,
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    extras: [],
  };
}

export function normalizeModuleRow(row: ModuleAccessRow): ModuleAccessRow {
  if (!row.canRead) {
    return { ...row, canCreate: false, canUpdate: false, canDelete: false, extras: [] };
  }
  return row;
}

export function permissionsFromModuleRow(row: ModuleAccessRow): Permission[] {
  const def = MODULE_CATALOG[row.module];
  const out = new Set<Permission>();
  if (!row.canRead) return [];
  for (const action of ['read', 'create', 'update', 'delete'] as const) {
    if (!def.crud[action]) continue;
    const flag =
      action === 'read' ? row.canRead : action === 'create' ? row.canCreate : action === 'update' ? row.canUpdate : row.canDelete;
    if (!flag) continue;
    for (const p of def.permissionMap[action] ?? []) out.add(p);
  }
  for (const extra of row.extras) {
    if (def.specials.some((s) => s.id === extra)) out.add(extra as Permission);
  }
  return [...out];
}
