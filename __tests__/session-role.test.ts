import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role as PrismaUserRole } from '@prisma/client';

const findFirst = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organizationMembership: { findFirst },
  },
}));

import { resolveSessionRole } from '@/platform/security/authorization/session-role';

describe('resolveSessionRole', () => {
  const previousOrgId = process.env.DEFAULT_ORGANIZATION_ID;

  beforeEach(() => {
    findFirst.mockReset();
    process.env.DEFAULT_ORGANIZATION_ID = 'org_cni_default';
  });

  afterEach(() => {
    if (previousOrgId === undefined) delete process.env.DEFAULT_ORGANIZATION_ID;
    else process.env.DEFAULT_ORGANIZATION_ID = previousOrgId;
  });

  it.each([
    ['ADMIN'],
    ['ADMINISTRACION'],
    ['SECRETARIA'],
    ['IT_MANAGER'],
  ] as const)('returns %s from the active CNI membership', async (role) => {
    findFirst.mockResolvedValueOnce({ role });

    await expect(resolveSessionRole('user-1', 'USER')).resolves.toBe(role);
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1',
        organizationId: 'org_cni_default',
        status: 'ACTIVE',
      }),
    }));
  });

  it('falls back to an active membership in another organization', async () => {
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: 'ADMINISTRACION' });

    await expect(resolveSessionRole('user-1', 'USER')).resolves.toBe('ADMINISTRACION');
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('falls back to User.role when membership is absent', async () => {
    findFirst.mockResolvedValue(null);

    await expect(resolveSessionRole('user-1', 'ADMIN')).resolves.toBe('ADMIN');
    await expect(resolveSessionRole('user-2', 'IT')).resolves.toBe('IT');
    await expect(resolveSessionRole('user-3', 'RRHH')).resolves.toBe('RRHH');
    await expect(resolveSessionRole('user-4', 'USER')).resolves.toBe('USER');
  });

  it('falls back to User.role when Prisma membership lookup throws', async () => {
    findFirst.mockRejectedValue(new Error('relation organization_memberships does not exist'));

    await expect(resolveSessionRole('user-1', 'ADMIN' satisfies PrismaUserRole)).resolves.toBe('ADMIN');
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
