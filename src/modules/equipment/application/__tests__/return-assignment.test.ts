import { beforeEach, describe, expect, it, vi } from 'vitest';
import { returnEquipmentAssignment } from '@/modules/equipment/application/assignment-service';

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(async () => undefined),
}));

vi.mock('@/modules/equipment/infrastructure/equipment-history', () => ({
  logEquipmentHistory: vi.fn(async () => undefined),
  mapReturnConditionToStatus: vi.fn(() => 'AVAILABLE'),
}));

vi.mock('@/modules/equipment/application/acta-generation', () => ({
  generateDeliveryActaPdf: vi.fn(async () => ({ url: '/acta', storageKey: 'key' })),
  generateReturnActaPdf: vi.fn(async () => ({ url: '/acta', storageKey: 'key' })),
}));

const findAssignmentById = vi.fn();
const findAssignmentWithRelations = vi.fn();
const returnAssignmentInTransaction = vi.fn();

vi.mock('@/modules/equipment/infrastructure/equipment-repository', () => ({
  findAssignmentById: (...args: unknown[]) => findAssignmentById(...args),
  findAssignmentWithRelations: (...args: unknown[]) => findAssignmentWithRelations(...args),
  returnAssignmentInTransaction: (...args: unknown[]) => returnAssignmentInTransaction(...args),
}));

vi.mock('@/modules/equipment/presentation/equipment-mapper', () => ({
  mapAssignmentResponse: (row: { id: string }) => ({ id: row.id }),
}));

describe('equipment application · returnEquipmentAssignment', () => {
  beforeEach(() => {
    findAssignmentById.mockReset();
    findAssignmentWithRelations.mockReset();
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
    const returned = { id: 'asg-1', status: 'RETURNED' };
    returnAssignmentInTransaction.mockResolvedValueOnce({
      updatedAssignment: returned,
      previousEquipmentStatus: 'ASSIGNED',
      equipmentCode: 'TI-PC-0001',
      equipmentId: 'eq-1',
    });
    findAssignmentWithRelations.mockResolvedValueOnce(returned);
    const result = await returnEquipmentAssignment({
      organizationId: 'org-1',
      assignmentId: 'asg-1',
      returnedById: 'user-1',
      body: { returnReason: 'Fin de proyecto' },
    });
    expect(result.kind).toBe('ok');
  });
});
