import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: { findFirst: vi.fn() },
    equipmentAssignment: { findMany: vi.fn() },
    licenseAssignment: { findMany: vi.fn() },
  },
}));

vi.mock('@/modules/people/infrastructure/employee-assets', () => ({
  findEmployeeActiveAssetsDetail: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { getDischargeActaPrefill } from '@/modules/equipment/application/discharge-acta-service';

describe('discharge acta prefill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('precarga equipos activos y enmascara clave DEVICE en licencias', async () => {
    vi.mocked(prisma.employee.findFirst).mockResolvedValue({
      id: 'emp-1',
      fullName: 'Ana Ficticia',
      dni: '0801-1990-00000',
      position: { name: 'Analista' },
    } as never);

    vi.mocked(prisma.equipmentAssignment.findMany).mockResolvedValue([
      {
        equipment: {
          type: 'LAPTOP',
          brand: 'Dell',
          model: 'Latitude',
          serialNumber: 'SN-1',
          includedAccessories: 'Mouse, cargador',
        },
      },
    ] as never);

    vi.mocked(prisma.licenseAssignment.findMany).mockResolvedValue([
      {
        seat: {
          seatType: 'DEVICE',
          accountEmail: null,
          accountIdentifier: 'device-seat',
          licenseKey: 'SUPER-SECRET-LICENSE-KEY-12345',
          subscription: { product: { name: 'Windows Pro' } },
        },
      },
      {
        seat: {
          seatType: 'INDIVIDUAL',
          accountEmail: 'ana@cni.hn',
          accountIdentifier: null,
          licenseKey: null,
          subscription: { product: { name: 'Microsoft 365' } },
        },
      },
    ] as never);

    const prefill = await getDischargeActaPrefill('org-1', 'emp-1');
    expect(prefill?.equipmentRows).toHaveLength(1);
    expect(prefill?.equipmentRows[0]?.serial).toBe('SN-1');
    expect(prefill?.licenseRows[0]?.licenseNumber).toMatch(/•••••/);
    expect(prefill?.licenseRows[0]?.licenseNumber).not.toContain('SUPER-SECRET');
    expect(prefill?.licenseRows[1]?.licenseNumber).toBe('ana@cni.hn');
  });
});
