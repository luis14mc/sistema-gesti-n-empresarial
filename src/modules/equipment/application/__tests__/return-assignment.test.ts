import { beforeEach, describe, expect, it, vi } from 'vitest';
import { returnEquipmentAssignment } from '@/modules/equipment/application/assignment-service';

vi.mock('@/lib/audit', () => ({
  createAuditRecord: vi.fn(async () => undefined),
}));

vi.mock('@/modules/equipment/infrastructure/equipment-history', () => ({
  logEquipmentHistory: vi.fn(async () => undefined),
  mapReturnConditionToStatus: vi.fn(() => 'AVAILABLE'),
}));

const findAssignmentById = vi.fn();
const returnAssignmentInTransaction = vi.fn();

vi.mock('@/modules/equipment/infrastructure/equipment-repository', () => ({
  findAssignmentById: (...args: unknown[]) => findAssignmentById(...args),
  returnAssignmentInTransaction: (...args: unknown[]) => returnAssignmentInTransaction(...args),
}));

vi.mock('@/modules/equipment/presentation/equipment-mapper', () => ({
  mapAssignmentResponse: (row: { id: string }) => ({ id: row.id }),
}));

describe('equipment application · returnEquipmentAssignment', () => {
  beforeEach(() => {
    findAssignmentById.mockReset();
    returnAssignmentInTransaction.mockReset();
  });

  it('returns not_found when assignment does not exist', async () => {
    findAssignmentById.mockResolvedValueOnce(null);
    const result = await returnEquipmentAssignment({
      organizationId: 'org-1',
      assignmentId: 'asg-1',
      returnedById: 'user-1',
      body: {},
    });
    expect(result.kind).toBe('not_found');
  });

  it('returns closed when assignment is not ACTIVE', async () => {
    findAssignmentById.mockResolvedValueOnce({ id: 'asg-1', status: 'RETURNED', equipmentId: 'eq-1', notes: null });
    const result = await returnEquipmentAssignment({
      organizationId: 'org-1',
      assignmentId: 'asg-1',
      returnedById: 'user-1',
      body: {},
    });
    expect(result.kind).toBe('closed');
  });

  it('returns ok when return transaction completes', async () => {
    findAssignmentById.mockResolvedValueOnce({
      id: 'asg-1',
      status: 'ACTIVE',
      equipmentId: 'eq-1',
      notes: null,
      equipment: { status: 'ASSIGNED' },
    });
    returnAssignmentInTransaction.mockResolvedValueOnce({
      updatedAssignment: { id: 'asg-1' },
      previousEquipmentStatus: 'ASSIGNED',
      equipmentCode: 'TI-PC-0001',
      equipmentId: 'eq-1',
    });
    const result = await returnEquipmentAssignment({
      organizationId: 'org-1',
      assignmentId: 'asg-1',
      returnedById: 'user-1',
      body: { returnReason: 'Fin de proyecto' },
    });
    expect(result.kind).toBe('ok');
  });
});
