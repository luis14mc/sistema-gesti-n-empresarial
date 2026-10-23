import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import * as equipmentRepository from '@/modules/equipment/infrastructure/equipment-repository';
import * as licenseClose from '@/modules/software-licenses/infrastructure/close-license-assignment-in-tx';
import { closeEmployeeAssetsForDischargeInTransaction } from '@/modules/equipment/infrastructure/discharge-acta-repository';

describe('closeEmployeeAssetsForDischargeInTransaction', () => {
  const tx = {
    equipmentAssignment: {
      findMany: vi.fn(),
    },
    licenseAssignment: {
      findMany: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(tx as never),
    );
  });

  it('hace rollback si falla una devolución de equipo (no cierra licencias)', async () => {
    vi.mocked(tx.equipmentAssignment.findMany).mockResolvedValue([
      { id: 'asg-1', equipment: { inventoryCode: 'CNI-1' } },
      { id: 'asg-2', equipment: { inventoryCode: 'CNI-2' } },
    ]);

    const returnSpy = vi
      .spyOn(equipmentRepository, 'returnAssignmentInTransaction')
      .mockResolvedValueOnce({
        updatedAssignment: {},
        previousEquipmentStatus: 'ASSIGNED',
        equipmentCode: 'CNI-1',
        equipmentId: 'eq-1',
      } as never)
      .mockRejectedValueOnce(new Error('NOT_FOUND'));

    const licenseSpy = vi.spyOn(licenseClose, 'closeLicenseAssignmentInTransaction');

    await expect(
      closeEmployeeAssetsForDischargeInTransaction({
        organizationId: 'org-1',
        employeeId: 'emp-1',
        actorUserId: 'user-1',
        returnReason: 'Terminación de relación laboral',
        returnNotes: 'Notas',
      }),
    ).rejects.toThrow(/Ningún cambio fue guardado/);

    expect(licenseSpy).not.toHaveBeenCalled();
    expect(tx.licenseAssignment.findMany).not.toHaveBeenCalled();

    returnSpy.mockRestore();
    licenseSpy.mockRestore();
  });
});
