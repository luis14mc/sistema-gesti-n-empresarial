import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assignEquipment } from '@/modules/equipment/application/assignment-service';
import { resolveEquipmentCategory } from '@/modules/equipment/domain/equipment-asset-code';

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

vi.mock('@/modules/equipment/application/acta-generation', () => ({
  generateDeliveryActaPdf: vi.fn(async () => ({ url: '/acta', storageKey: 'key' })),
  generateReturnActaPdf: vi.fn(async () => ({ url: '/acta', storageKey: 'key' })),
}));

const assignEquipmentInTransaction = vi.fn();
const findAssignmentWithRelations = vi.fn();

vi.mock('@/modules/equipment/infrastructure/equipment-repository', () => ({
  assignEquipmentInTransaction: (...args: unknown[]) => assignEquipmentInTransaction(...args),
  findAssignmentWithRelations: (...args: unknown[]) => findAssignmentWithRelations(...args),
  countAssignments: vi.fn(),
  listAssignments: vi.fn(),
}));

vi.mock('@/modules/equipment/presentation/equipment-mapper', () => ({
  mapAssignmentResponse: (row: { id: string }) => ({ id: row.id, mapped: true }),
}));

describe('equipment application · asset code domain', () => {
  it('resolveEquipmentCategory maps legacy DESKTOP to DESKTOP_PC', () => {
    expect(resolveEquipmentCategory(undefined, 'DESKTOP')).toBe('DESKTOP_PC');
  });
});

describe('equipment application · assignEquipment', () => {
  beforeEach(() => {
    assignEquipmentInTransaction.mockReset();
    findAssignmentWithRelations.mockReset();
  });

  it('returns validation when equipment or assignee is missing', async () => {
    const result = await assignEquipment({
      organizationId: 'org-1',
      assignedById: 'user-1',
      body: { equipmentId: 'eq-1' },
    });
    expect(result.kind).toBe('validation');
  });

  it('returns not_available when repository rejects assignment', async () => {
    assignEquipmentInTransaction.mockRejectedValueOnce(new Error('ALREADY_ASSIGNED'));
    const result = await assignEquipment({
      organizationId: 'org-1',
      assignedById: 'user-1',
      body: { equipmentId: 'eq-1', employeeId: 'emp-1' },
    });
    expect(result.kind).toBe('not_available');
  });

  it('creates assignment when repository succeeds', async () => {
    const created = {
      id: 'asg-1',
      equipmentId: 'eq-1',
      equipment: { inventoryCode: 'TI-PC-0001' },
    };
    assignEquipmentInTransaction.mockResolvedValueOnce(created);
    findAssignmentWithRelations.mockResolvedValueOnce(created);
    const result = await assignEquipment({
      organizationId: 'org-1',
      assignedById: 'user-1',
      body: { equipmentId: 'eq-1', employeeId: 'emp-1' },
    });
    expect(result.kind).toBe('created');
    if (result.kind === 'created') {
      expect(result.assignment).toMatchObject({ id: 'asg-1', mapped: true });
    }
  });
});
