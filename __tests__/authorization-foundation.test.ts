import type { OrganizationRole, PlatformRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { PermissionDeniedError } from '@/platform/domain/errors';
import {
  ORGANIZATION_PERMISSIONS,
  PERMISSIONS,
  can,
  organizationRole,
  platformRole,
  requirePermission,
} from '@/platform/security/authorization/permissions';
import { AuditLogQueryService } from '@/platform/security/audit/audit-log-query-service';

const organizationRoles: OrganizationRole[] = ['OWNER', 'ADMIN', 'IT_MANAGER', 'IT_TECHNICIAN', 'PROCUREMENT', 'HR', 'AUDITOR', 'USER'];
const platformRoles: PlatformRole[] = ['PLATFORM_ADMIN', 'SUPPORT_ADMIN'];

describe('Phase 6A capability authorization', () => {
  it('defines unique capabilities and an explicit decision for every role', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    for (const role of organizationRoles) {
      for (const permission of PERMISSIONS) expect(typeof can(organizationRole(role), permission)).toBe('boolean');
    }
    for (const role of platformRoles) {
      for (const permission of PERMISSIONS) expect(typeof can(platformRole(role), permission)).toBe('boolean');
    }
  });

  it('keeps platform authority separate from organization membership authority', () => {
    expect(can(platformRole('PLATFORM_ADMIN'), 'platform.health.read')).toBe(true);
    expect(can(platformRole('PLATFORM_ADMIN'), 'equipment.read')).toBe(false);
    expect(can(organizationRole('OWNER'), 'platform.health.read')).toBe(false);
    expect(can('ADMIN' as never, 'organizations.manage')).toBe(false);
  });

  it('does not use wildcard permissions for organization owners', () => {
    expect(ORGANIZATION_PERMISSIONS.every((permission) => can(organizationRole('OWNER'), permission))).toBe(true);
    expect(can(organizationRole('USER'), 'memberships.manage')).toBe(false);
    expect(can(organizationRole('AUDITOR'), 'audit.read')).toBe(true);
  });

  it('requires the server-resolved scoped context', () => {
    const context = { authorizationScope: 'organization', userId: 'user-1', organizationId: 'org-1', role: 'USER' } as const;
    expect(() => requirePermission(context, 'equipment.read')).not.toThrow();
    expect(() => requirePermission(context, 'equipment.update')).toThrow(PermissionDeniedError);
  });

  it('uses membership authority even when the legacy JWT role is stronger or weaker', () => {
    const legacyAdminWithUserMembership = {
      authorizationScope: 'organization', userId: 'user-1', organizationId: 'org-1', role: 'USER', legacyJwtRole: 'ADMIN',
    } as const;
    const legacyUserWithOwnerMembership = {
      authorizationScope: 'organization', userId: 'user-2', organizationId: 'org-1', role: 'OWNER', legacyJwtRole: 'USER',
    } as const;

    expect(() => requirePermission(legacyAdminWithUserMembership, 'memberships.manage')).toThrow(PermissionDeniedError);
    expect(() => requirePermission(legacyUserWithOwnerMembership, 'memberships.manage')).not.toThrow();
  });

  it('rejects audit reads before querying for an unauthorized membership', async () => {
    const context = {
      authorizationScope: 'organization', userId: 'user-1', organizationId: 'org-1', organizationSlug: 'org-1',
      timezone: 'America/Tegucigalpa', membershipId: 'membership-1', role: 'USER',
    } as const;
    const service = new AuditLogQueryService();
    await expect(service.list(context, { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
