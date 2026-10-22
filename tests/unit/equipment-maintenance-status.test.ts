import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMaintenanceInTransactionMock = vi.fn();
const findMaintenanceRecordMock = vi.fn();

vi.mock('@/modules/equipment/infrastructure/equipment-repository', () => ({
  findMaintenanceRecord: (...args: unknown[]) => findMaintenanceRecordMock(...args),
  updateMaintenanceInTransaction: (...args: unknown[]) => updateMaintenanceInTransactionMock(...args),
}));

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(),
}));

const { updateMaintenanceRecord } = await import('@/modules/equipment/application/maintenance-service');

describe('updateMaintenanceRecord — estado del equipo', () => {
  beforeEach(() => {
    findMaintenanceRecordMock.mockReset();
    updateMaintenanceInTransactionMock.mockReset();
  });

  it('al completar mantenimiento activo solicita AVAILABLE cuando ya no hay abiertos', async () => {
    findMaintenanceRecordMock.mockResolvedValue({
      id: 'm-1',
      status: 'IN_PROGRESS',
      description: 'Cambio de disco',
      equipmentId: 'eq-1',
    });
    updateMaintenanceInTransactionMock.mockResolvedValue({
      id: 'm-1',
      status: 'COMPLETED',
      equipmentId: 'eq-1',
      description: 'Cambio de disco',
      equipment: { id: 'eq-1', inventoryCode: 'TI-1', brand: 'Dell', model: 'X' },
    });

    const result = await updateMaintenanceRecord({
      id: 'm-1',
      organizationId: 'org-1',
      userId: 'user-1',
      body: { status: 'COMPLETED' },
    });

    expect(result.kind).toBe('ok');
    expect(updateMaintenanceInTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        wasActive: true,
        isNowActive: false,
        updateData: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });
});
