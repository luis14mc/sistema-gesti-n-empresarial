// Phase 10A — fixtures for organization modules and per-organization
// permissions. These are *shape* fixtures: they do not touch the database
// and they do not assume any specific persistence layout. They exist so
// tests that exercise authorization code can construct realistic
// scenarios without re-implementing the same setup.

import type { OrganizationRole } from '@prisma/client';
import { can, organizationRole, platformRole, type Permission } from '@/platform/security/authorization/permissions';

export type ModuleFlag =
  | 'OFFICES'
  | 'EQUIPMENT'
  | 'DISPOSAL'
  | 'PURCHASES'
  | 'AUDITS'
  | 'INTEGRATIONS'
  | 'NOTIFICATIONS'
  | 'REPORTS';

export type TestOrganizationModules = Readonly<{
  OFFICES: boolean;
  EQUIPMENT: boolean;
  DISPOSAL: boolean;
  PURCHASES: boolean;
  AUDITS: boolean;
  INTEGRATIONS: boolean;
  NOTIFICATIONS: boolean;
  REPORTS: boolean;
}>;

export function seedOrganizationModules(
  overrides: Partial<TestOrganizationModules> = {},
): TestOrganizationModules {
  return {
    OFFICES: true,
    EQUIPMENT: true,
    DISPOSAL: true,
    PURCHASES: true,
    AUDITS: true,
    INTEGRATIONS: false,
    NOTIFICATIONS: true,
    REPORTS: true,
    ...overrides,
  };
}

export function isModuleEnabled(
  modules: TestOrganizationModules,
  module: ModuleFlag,
): boolean {
  return modules[module] === true;
}

export type SeededPermissionMatrix = Readonly<{
  role: OrganizationRole;
  granted: readonly Permission[];
  denied: readonly Permission[];
}>;

export function seedPermissions(role: OrganizationRole): SeededPermissionMatrix {
  const fullSet: readonly Permission[] = [
    'organizations.manage',
    'memberships.manage',
    'users.read', 'users.create', 'users.update', 'users.deactivate',
    'offices.read', 'offices.create', 'offices.update', 'offices.send',
    'offices.receive', 'offices.complete', 'offices.cancel', 'offices.import', 'offices.download',
    'equipment.read', 'equipment.create', 'equipment.update', 'equipment.assign',
    'equipment.maintain', 'equipment.dispose',
    'equipment-disposal.read', 'equipment-disposal.create', 'equipment-disposal.update',
    'equipment-disposal.submit', 'equipment-disposal.approve', 'equipment-disposal.reject',
    'equipment-disposal.cancel', 'equipment-disposal.configure', 'equipment-disposal.download',
    'purchase-orders.read', 'purchase-orders.create', 'purchase-orders.update',
    'purchase-orders.generate', 'purchase-orders.cancel', 'purchase-orders.download',
    'reports.view', 'reports.export', 'reports.financial',
    'reports.financial.purchases', 'reports.financial.equipment', 'reports.audit',
    'dashboard.view', 'dashboard.executive',
    'audit.read',
    'notifications.read', 'notifications.manage-own-preferences', 'notifications.manage-organization-settings',
    'notifications.retry-failed', 'notifications.view-deliveries',
    'integrations.read', 'integrations.create', 'integrations.update',
    'integrations.enable', 'integrations.disable', 'integrations.test',
    'integrations.rotate-credentials', 'integrations.view-history', 'integrations.retry',
    'webhooks.manage',
  ] as const;

  const granted = fullSet.filter((permission) => can(organizationRole(role), permission));
  const denied = fullSet.filter((permission) => !can(organizationRole(role), permission));
  return { role, granted, denied };
}

export function platformPermissionsFor(
  role: 'PLATFORM_ADMIN' | 'SUPPORT_ADMIN',
): readonly Permission[] {
  const platformOnly: readonly Permission[] = [
    'platform.health.read',
    'platform.audit.read',
    'reports.platform',
  ] as const;
  return platformOnly.filter((permission) => can(platformRole(role), permission));
}
