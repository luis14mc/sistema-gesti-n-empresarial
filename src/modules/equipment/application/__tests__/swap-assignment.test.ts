import { beforeEach, describe, expect, it, vi } from 'vitest';
import { swapEquipmentAssignment } from '@/modules/equipment/application/assignment-service';

vi.mock('@/modules/people/application/resolve-employee-snapshot', () => ({
  resolveEmployeeSnapshot: vi.fn(async () => ({
    employeeId: 'emp-1',
    departmentAtTime: 'TI',
    positionAtTime: 'Analista',
    employeeEmailAtTime: 'a@test.com',
    employeeNameAtTime: 'Ana Test',
  })),
}));

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(async () => undefined),
}));

vi.mock('@/modules/equipment/infrastructure/equipment-history', () => ({
  logEquipmentHistory: vi.fn(async () => undefined),
  mapReturnConditionToStatus: vi.fn(() => 'AVAILABLE'),
}));

const findActiveAssignmentForSwap = vi.fn();
const swapAssignmentInTransaction = vi.fn();

vi.mock('@/modules/equipment/infrastructure/equipment-repository', () => ({
  findActiveAssignmentForSwap: (...args: unknown[]) => findActiveAssignmentForSwap(...args),
  swapAssignmentInTransaction: (...args: unknown[]) => swapAssignmentInTransaction(...args),
}));

vi.mock('@/modules/equipment/presentation/equipment-mapper', () => ({
  mapAssignmentResponse: (row: { id: string }) => ({ id: row.id }),
}));

describe('equipment application · swapEquipmentAssignment', () => {
  beforeEach(() => {
    findActiveAssignmentForSwap.mockReset();
    swapAssignmentInTransaction.mockReset();
  });

  it('maps OLD_NOT_ACTIVE from repository to old_inactive', async () => {
    findActiveAssignmentForSwap.mockResolvedValueOnce({
      id: 'old-asg',
      status: 'ACTIVE',
      employeeId: 'emp-1',
      userId: null,
      equipmentId: 'eq-old',
      equipment: { inventoryCode: 'TI-PC-0001' },
    });
    swapAssignmentInTransaction.mockRejectedValueOnce(new Error('OLD_NOT_ACTIVE'));

    const result = await swapEquipmentAssignment({
      organizationId: 'org-1',
      assignedById: 'user-1',
      body: { oldAssignmentId: 'old-asg', newEquipmentId: 'eq-new' },
    });

    expect(result.kind).toBe('old_inactive');
  });

  it('passes closedReturnNotes and newAssignmentNotes separately to the repository', async () => {
    findActiveAssignmentForSwap.mockResolvedValueOnce({
      id: 'old-asg',
      status: 'ACTIVE',
      employeeId: 'emp-1',
      userId: null,
      equipmentId: 'eq-old',
      equipment: { inventoryCode: 'TI-PC-0001' },
    });
    swapAssignmentInTransaction.mockResolvedValueOnce({
      closedAssignment: { id: 'old-asg' },
      newAssignment: { id: 'new-asg', equipment: { inventoryCode: 'TI-PC-0002' } },
      oldEquipmentId: 'eq-old',
    });

    await swapEquipmentAssignment({
      organizationId: 'org-1',
      assignedById: 'user-1',
      body: {
        oldAssignmentId: 'old-asg',
        newEquipmentId: 'eq-new',
        assignmentNotes: 'Nota de cambio',
        accessories: 'Mouse, teclado',
      },
    });

    expect(swapAssignmentInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        closedReturnNotes: 'Nota de cambio',
        newAssignmentNotes: 'Nota de cambio\nAccesorios: Mouse, teclado',
      }),
    );
  });
});
