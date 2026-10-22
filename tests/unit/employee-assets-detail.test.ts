import { beforeEach, describe, expect, it, vi } from 'vitest';

const findManyMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    equipmentAssignment: { findMany: (...args: unknown[]) => findManyMock(...args) },
    licenseAssignment: { findMany: vi.fn() },
  },
}));

describe('findEmployeeActiveAssetsDetail', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
  });

  it('no consulta licencias cuando includeLicenses es false', async () => {
    const { prisma } = await import('@/lib/prisma');
    const licenseFindMany = vi.mocked(prisma.licenseAssignment.findMany);
    licenseFindMany.mockClear();

    const { findEmployeeActiveAssetsDetail } = await import(
      '@/modules/people/infrastructure/employee-assets'
    );

    const result = await findEmployeeActiveAssetsDetail('org-1', 'emp-1', {
      includeLicenses: false,
    });

    expect(licenseFindMany).not.toHaveBeenCalled();
    expect(result.licencias).toEqual([]);
  });

  it('consulta licencias cuando includeLicenses es true', async () => {
    const { prisma } = await import('@/lib/prisma');
    const licenseFindMany = vi.mocked(prisma.licenseAssignment.findMany);
    licenseFindMany.mockResolvedValue([
      {
        id: 'assign-1',
        assignedAt: new Date('2026-03-01'),
        seat: {
          id: 'seat-1',
          accountEmail: 'user@cni.hn',
          accountIdentifier: null,
          subscription: {
            id: 'sub-1',
            planName: 'Standard',
            product: { name: 'Adobe' },
          },
        },
      },
    ] as never);

    const { findEmployeeActiveAssetsDetail } = await import(
      '@/modules/people/infrastructure/employee-assets'
    );

    const result = await findEmployeeActiveAssetsDetail('org-1', 'emp-1', {
      includeLicenses: true,
    });

    expect(licenseFindMany).toHaveBeenCalledOnce();
    expect(result.licencias).toHaveLength(1);
    expect(result.licencias[0].producto).toBe('Adobe');
  });
});
