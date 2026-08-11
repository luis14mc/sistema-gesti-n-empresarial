import type { OrganizationRole, PlatformRole } from '@prisma/client';
import { PermissionDeniedError } from '@/platform/domain/errors';

export const ORGANIZATION_PERMISSIONS = [
  'organizations.manage',
  'memberships.manage',
  'users.read',
  'users.create',
  'users.update',
  'users.deactivate',
  'offices.read',
  'offices.create',
  'offices.update',
  'offices.send',
  'offices.receive',
  'offices.complete',
  'offices.cancel',
  'offices.import',
  'offices.download',
  'equipment.read',
  'equipment.create',
  'equipment.update',
  'equipment.assign',
  'equipment.maintain',
  'equipment.dispose',
  'equipment-disposal.read',
  'equipment-disposal.create',
  'equipment-disposal.update',
  'equipment-disposal.submit',
  'equipment-disposal.approve',
  'equipment-disposal.reject',
  'equipment-disposal.cancel',
  'equipment-disposal.configure',
  'equipment-disposal.download',
  'purchase-orders.read',
  'purchase-orders.create',
  'purchase-orders.update',
  'purchase-orders.generate',
  'purchase-orders.cancel',
  'purchase-orders.download',
  'reports.view',
  'reports.export',
  'reports.financial',
  'reports.financial.purchases',
  'reports.financial.equipment',
  'reports.audit',
  'dashboard.view',
  'dashboard.executive',
  'audit.read',
  'notifications.read',
  'notifications.manage-own-preferences',
  'notifications.manage-organization-settings',
  'notifications.retry-failed',
  'notifications.view-deliveries',
  'integrations.read',
  'integrations.create',
  'integrations.update',
  'integrations.enable',
  'integrations.disable',
  'integrations.test',
  'integrations.rotate-credentials',
  'integrations.view-history',
  'integrations.retry',
  'webhooks.manage',
] as const;

export const PLATFORM_PERMISSIONS = [
  'platform.health.read',
  'platform.audit.read',
  'reports.platform',
] as const;

export const PERMISSIONS = [...ORGANIZATION_PERMISSIONS, ...PLATFORM_PERMISSIONS] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type ScopedRole =
  | Readonly<{ scope: 'organization'; role: OrganizationRole }>
  | Readonly<{ scope: 'platform'; role: PlatformRole }>;

export type PermissionContext =
  | Readonly<{ authorizationScope: 'organization'; userId: string; organizationId: string; role: OrganizationRole }>
  | Readonly<{ authorizationScope: 'platform'; userId: string; role: PlatformRole }>;

const DISPOSAL_READ = ['equipment-disposal.read', 'equipment-disposal.download'] as const;
const REPORT_READ = ['reports.view', 'reports.export', 'dashboard.view'] as const;

const NOTIFICATION_BASELINE = ['notifications.read'] as const;
const NOTIFICATION_OWN_PREFERENCES = ['notifications.read', 'notifications.manage-own-preferences'] as const;
const NOTIFICATION_ADMIN = [...NOTIFICATION_BASELINE, 'notifications.manage-organization-settings', 'notifications.retry-failed', 'notifications.view-deliveries'] as const;
const INTEGRATIONS_BASELINE = ['integrations.read'] as const;
const INTEGRATIONS_OPERATOR = ['integrations.read', 'integrations.test', 'integrations.view-history'] as const;

const ORGANIZATION_ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: ORGANIZATION_PERMISSIONS,
  ADMIN: ORGANIZATION_PERMISSIONS,
  IT_MANAGER: [
    'users.read',
    'offices.read', 'offices.download',
    'equipment.read', 'equipment.create', 'equipment.update', 'equipment.assign', 'equipment.maintain', 'equipment.dispose',
    ...DISPOSAL_READ, 'equipment-disposal.create', 'equipment-disposal.update', 'equipment-disposal.submit',
    'equipment-disposal.approve', 'equipment-disposal.reject', 'equipment-disposal.cancel',
    'purchase-orders.read', 'purchase-orders.download',
    ...REPORT_READ, 'reports.financial', 'reports.financial.equipment',
    ...NOTIFICATION_OWN_PREFERENCES,
    ...INTEGRATIONS_OPERATOR,
  ],
  IT_TECHNICIAN: [
    'offices.read', 'offices.download',
    'equipment.read', 'equipment.create', 'equipment.update', 'equipment.assign', 'equipment.maintain',
    ...DISPOSAL_READ, 'equipment-disposal.create', 'equipment-disposal.update', 'equipment-disposal.submit',
    'purchase-orders.read', 'purchase-orders.download',
    ...REPORT_READ,
    ...NOTIFICATION_BASELINE,
  ],
  PROCUREMENT: [
    'users.read',
    'offices.read', 'offices.create', 'offices.update', 'offices.send', 'offices.receive', 'offices.complete', 'offices.cancel', 'offices.download',
    'equipment.read', ...DISPOSAL_READ,
    'purchase-orders.read', 'purchase-orders.create', 'purchase-orders.update', 'purchase-orders.generate', 'purchase-orders.cancel', 'purchase-orders.download',
    ...REPORT_READ, 'reports.financial', 'reports.financial.purchases',
    ...NOTIFICATION_BASELINE,
  ],
  HR: [
    'users.read', 'users.create', 'users.update',
    'offices.read', 'offices.create', 'offices.update', 'offices.send', 'offices.receive', 'offices.complete', 'offices.cancel', 'offices.download',
    'equipment.read', ...DISPOSAL_READ,
    'purchase-orders.read', 'purchase-orders.download',
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
    'offices.read',
    'equipment.read',
    'equipment-disposal.read',
    'purchase-orders.read',
    'dashboard.view',
    'notifications.read',
  ],
};

void NOTIFICATION_ADMIN;
void INTEGRATIONS_BASELINE;

const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly Permission[]> = {
  PLATFORM_ADMIN: PLATFORM_PERMISSIONS,
  SUPPORT_ADMIN: ['platform.health.read'],
};

export function organizationRole(role: OrganizationRole): ScopedRole {
  return { scope: 'organization', role };
}

export function platformRole(role: PlatformRole): ScopedRole {
  return { scope: 'platform', role };
}

export function can(scopedRole: ScopedRole, permission: Permission): boolean {
  if (!scopedRole || typeof scopedRole !== 'object') return false;
  const permissions = scopedRole.scope === 'organization'
    ? ORGANIZATION_ROLE_PERMISSIONS[scopedRole.role]
    : scopedRole.scope === 'platform'
      ? PLATFORM_ROLE_PERMISSIONS[scopedRole.role]
      : undefined;
  return Boolean(permissions?.includes(permission));
}

export function requirePermission(context: PermissionContext, permission: Permission): void {
  const scopedRole = context.authorizationScope === 'organization'
    ? organizationRole(context.role)
    : platformRole(context.role);
  if (!can(scopedRole, permission)) {
    throw new PermissionDeniedError('No tiene permiso para realizar esta operación.', {
      permission,
      scope: context.authorizationScope,
    });
  }
}
