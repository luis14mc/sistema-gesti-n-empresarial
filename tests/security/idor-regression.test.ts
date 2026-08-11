import { describe, expect, it } from 'vitest';
import { applyIdorFilter, checkItemAccess } from '@/lib/idor';
import { createTestOrganizationPair, createTestUserPair, createTestMembership } from '../fixtures';

describe('applyIdorFilter (Phase 10A security regression)', () => {
  const { organizationA, organizationB } = createTestOrganizationPair();
  const { userA, userB } = createTestUserPair();

  it('ADMIN sees everything (no filter added)', () => {
    const base = { organizationId: organizationA.id };
    const result = applyIdorFilter(base, { role: 'ADMIN', userId: userA.id, userAccess: 'none' });
    expect(result).toEqual(base);
  });

  it('USER with self-record access is filtered by userId', () => {
    const result = applyIdorFilter({ isActive: true }, { role: 'USER', userId: userA.id, userAccess: 'self-record' });
    expect(result).toMatchObject({ isActive: true, userId: userA.id });
  });

  it('USER with owner access is filtered by createdById', () => {
    const result = applyIdorFilter({ isActive: true }, { role: 'USER', userId: userA.id, userAccess: 'owner' });
    expect(result).toMatchObject({ isActive: true, createdById: userA.id });
  });

  it('USER with none access is blocked by the sentinel id', () => {
    const result = applyIdorFilter({}, { role: 'USER', userId: userA.id, userAccess: 'none' });
    expect(result).toMatchObject({ id: '__never__' });
  });

  it('USER with assigned access adds an OR of ownership fields', () => {
    const result = applyIdorFilter({}, { role: 'USER', userId: userA.id, userAccess: 'assigned' });
    expect(result).toHaveProperty('OR');
    expect(Array.isArray((result as { OR?: unknown[] }).OR)).toBe(true);
  });

  it('IT and RRHH without extraForStaff are not additionally restricted', () => {
    const base = { organizationId: organizationA.id };
    const itResult = applyIdorFilter(base, { role: 'IT', userId: userA.id, userAccess: 'none' });
    const rrhhResult = applyIdorFilter(base, { role: 'RRHH', userId: userA.id, userAccess: 'none' });
    expect(itResult).toEqual(base);
    expect(rrhhResult).toEqual(base);
  });
});

describe('checkItemAccess (Phase 10A security regression)', () => {
  const { userA, userB } = createTestUserPair();

  it('returns false for a null item', () => {
    expect(checkItemAccess(null, { role: 'USER', userId: userA.id, userAccess: 'self-record' })).toBe(false);
  });

  it('ADMIN always has access', () => {
    const item = { id: 'x', userId: userB.id };
    expect(checkItemAccess(item, { role: 'ADMIN', userId: userA.id, userAccess: 'self-record' })).toBe(true);
  });

  it('USER with self-record only matches when userId matches', () => {
    const mine = { id: 'x', userId: userA.id };
    const other = { id: 'y', userId: userB.id };
    expect(checkItemAccess(mine, { role: 'USER', userId: userA.id, userAccess: 'self-record' })).toBe(true);
    expect(checkItemAccess(other, { role: 'USER', userId: userA.id, userAccess: 'self-record' })).toBe(false);
  });

  it('USER with owner matches by userId OR createdById', () => {
    expect(checkItemAccess({ id: 'a', userId: userA.id }, { role: 'USER', userId: userA.id, userAccess: 'owner' })).toBe(true);
    expect(checkItemAccess({ id: 'b', createdById: userA.id }, { role: 'USER', userId: userA.id, userAccess: 'owner' })).toBe(true);
    expect(checkItemAccess({ id: 'c', userId: userB.id, createdById: userB.id }, { role: 'USER', userId: userA.id, userAccess: 'owner' })).toBe(false);
  });

  it('honors the customCheck escape hatch', () => {
    const item = { id: 'special', flag: true };
    const result = checkItemAccess(item, {
      role: 'USER',
      userId: userA.id,
      userAccess: 'self-record',
      customCheck: (it) => Boolean((it as { flag?: boolean }).flag),
    });
    expect(result).toBe(true);
  });
});

describe('Cross-tenant invariants (Phase 10A security regression)', () => {
  const { organizationA, organizationB } = createTestOrganizationPair();
  const { userA } = createTestUserPair();

  it('the same user may belong to two organizations with the same role', () => {
    const membershipA = createTestMembership({ organizationId: organizationA.id, userId: userA.id, role: 'OWNER' });
    const membershipB = createTestMembership({ organizationId: organizationB.id, userId: userA.id, role: 'OWNER' });
    expect(membershipA.role).toBe(membershipB.role);
    expect(membershipA.organizationId).not.toBe(membershipB.organizationId);
  });

  it('membership.status can be ACTIVE in one organization and SUSPENDED in another', () => {
    const active = createTestMembership({ organizationId: organizationA.id, userId: userA.id, status: 'ACTIVE' });
    const suspended = createTestMembership({ organizationId: organizationB.id, userId: userA.id, status: 'SUSPENDED' });
    expect(active.status).toBe('ACTIVE');
    expect(suspended.status).toBe('SUSPENDED');
  });
});
