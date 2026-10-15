import type { OrganizationRole, Permission } from './permissions';
import { ORGANIZATION_PERMISSIONS } from './organization-permission-catalog';

const DISPOSAL_READ = ['equipment-disposal.read', 'equipment-disposal.download'] as const;
const REPORT_READ = ['reports.view', 'reports.export', 'dashboard.view'] as const;

const NOTIFICATION_BASELINE = ['notifications.read'] as const;
const NOTIFICATION_OWN_PREFERENCES = ['notifications.read', 'notifications.manage-own-preferences'] as const;

const INTEGRATIONS_OPERATOR = ['integrations.read', 'integrations.test', 'integrations.view-history'] as const;

const OFICIOS_OPERATIONAL = [
  'oficios.read', 'oficios.create', 'oficios.update', 'oficios.deactivate',
  'oficios.export', 'oficios.attachments', 'oficios.import',
] as const;

const OFICIOS_CONFIGURE = ['oficios.configure'] as const;

const PURCHASES_OPERATIONAL = [
  'purchase-orders.read', 'purchase-orders.create', 'purchase-orders.update',
  'purchase-orders.generate', 'purchase-orders.cancel', 'purchase-orders.download',
  'suppliers.read', 'suppliers.create', 'suppliers.update',
] as const;

const EMPLOYEES_OPERATIONAL = [
  'employees.read', 'employees.create', 'employees.update', 'employees.deactivate',
] as const;

const PAYROLL_OPERATIONAL = [
  'payroll.view', 'payroll.generate', 'payroll.configure',
] as const;

const SOFTWARE_LICENSES = [
  'software-licenses.read', 'software-licenses.create', 'software-licenses.update',
  'software-licenses.assign', 'software-licenses.manage', 'software-licenses.export',
] as const;

const EQUIPMENT_LIFECYCLE = [
  'equipment.read', 'equipment.create', 'equipment.update', 'equipment.assign',
  'equipment.maintain', 'equipment.dispose',
] as const;

const DISPOSAL_WORKFLOW = [
  ...DISPOSAL_READ,
  'equipment-disposal.create', 'equipment-disposal.update', 'equipment-disposal.submit',
  'equipment-disposal.approve', 'equipment-disposal.reject', 'equipment-disposal.cancel',
  'equipment-disposal.configure',
] as const;

/** Canonical CNI role matrix — protected RBAC tests assert against `can()` which uses this map. */
export const OFFICIAL_ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: ORGANIZATION_PERMISSIONS,
  ADMIN: ORGANIZATION_PERMISSIONS,
  ADMINISTRACION: [
    ...OFICIOS_OPERATIONAL,
    ...PURCHASES_OPERATIONAL,
    'purchase-orders.approve',
    ...EMPLOYEES_OPERATIONAL,
    'dashboard.view',
    ...NOTIFICATION_BASELINE,
  ],
  SECRETARIA: [
    ...OFICIOS_OPERATIONAL,
  ],
  IT_MANAGER: [
    ...SOFTWARE_LICENSES,
    ...EQUIPMENT_LIFECYCLE,
    ...DISPOSAL_WORKFLOW,
    ...OFICIOS_CONFIGURE,
    'employees.read',
    'users.read', 'users.create', 'users.update', 'users.deactivate',
    'memberships.manage',
    'audit.read',
    'dashboard.view',
    ...REPORT_READ, 'reports.financial.equipment',
    ...NOTIFICATION_OWN_PREFERENCES,
    ...INTEGRATIONS_OPERATOR,
  ],
  IT_TECHNICIAN: [
    'offices.read', 'offices.download',
    'equipment.read', 'equipment.create', 'equipment.update', 'equipment.assign', 'equipment.maintain',
    ...DISPOSAL_READ, 'equipment-disposal.create', 'equipment-disposal.update', 'equipment-disposal.submit',
    ...REPORT_READ,
    ...NOTIFICATION_BASELINE,
  ],
  PROCUREMENT: [
    'users.read',
    'offices.read', 'offices.create', 'offices.update', 'offices.send', 'offices.receive', 'offices.complete', 'offices.cancel', 'offices.download',
    'equipment.read', ...DISPOSAL_READ,
    ...PURCHASES_OPERATIONAL,
    ...REPORT_READ, 'reports.financial', 'reports.financial.purchases',
    ...NOTIFICATION_BASELINE,
  ],
  HR: [
    'users.read', 'users.create', 'users.update',
    ...EMPLOYEES_OPERATIONAL,
    ...PAYROLL_OPERATIONAL,
    'offices.read', 'offices.create', 'offices.update', 'offices.send', 'offices.receive', 'offices.complete', 'offices.cancel', 'offices.download',
    ...REPORT_READ,
    ...NOTIFICATION_BASELINE,
  ],
  AUDITOR: [
    'users.read',
    'offices.read', 'offices.download',
    'equipment.read', ...DISPOSAL_READ,
    'purchase-orders.read', 'purchase-orders.download',
    ...REPORT_READ, 'reports.financial', 'reports.financial.purchases', 'reports.financial.equipment', 'reports.audit',
    'audit.read',
    ...NOTIFICATION_BASELINE,
    ...INTEGRATIONS_OPERATOR,
  ],
  USER: [
    'dashboard.view',
    'oficios.read',
    'offices.read',
    'equipment.read',
    'equipment-disposal.read',
    'purchase-orders.read',
    'notifications.read',
  ],
  DIRECTOR: [
    'dashboard.view', 'reports.view', 'reports.export',
  ],
};

export function officialPermissionsForRole(role: OrganizationRole): readonly Permission[] {
  return OFFICIAL_ROLE_PERMISSIONS[role];
}

export function officialPermissionSetForRole(role: OrganizationRole): ReadonlySet<Permission> {
  return new Set(OFFICIAL_ROLE_PERMISSIONS[role]);
}

export function flattenOfficialRolePermissions(): Array<{ role: OrganizationRole; permission: Permission }> {
  const rows: Array<{ role: OrganizationRole; permission: Permission }> = [];
  for (const role of Object.keys(OFFICIAL_ROLE_PERMISSIONS) as OrganizationRole[]) {
    for (const permission of OFFICIAL_ROLE_PERMISSIONS[role]) {
      rows.push({ role, permission });
    }
  }
  return rows;
}
