import { beforeEach, describe, expect, it, vi } from 'vitest';

const findEmployeeMock = vi.fn();
const findEmployeeActiveAssetSummaryMock = vi.fn();
const updateEmployeeMock = vi.fn();
const findEmployeeWithPlacementSummaryMock = vi.fn();

vi.mock('@/modules/people/infrastructure/employee-repository', () => ({
  findEmployee: (...args: unknown[]) => findEmployeeMock(...args),
  findEmployeeActiveAssetSummary: (...args: unknown[]) => findEmployeeActiveAssetSummaryMock(...args),
  updateEmployee: (...args: unknown[]) => updateEmployeeMock(...args),
  findEmployeeWithPlacementSummary: (...args: unknown[]) => findEmployeeWithPlacementSummaryMock(...args),
}));

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(),
}));

const { updateEmployeeFields } = await import('@/modules/people/application/employees-service');

describe('updateEmployeeFields — desactivar con activos', () => {
  beforeEach(() => {
    findEmployeeMock.mockReset();
    findEmployeeActiveAssetSummaryMock.mockReset();
    updateEmployeeMock.mockReset();
    findEmployeeWithPlacementSummaryMock.mockReset();
    findEmployeeMock.mockResolvedValue({ id: 'emp-1', isActive: true, firstName: 'A', lastName: 'B' });
  });

  it('bloquea desactivación con equipos o licencias activas', async () => {
    findEmployeeActiveAssetSummaryMock.mockResolvedValue({
      equipos: ['TI-LAP-0001'],
      licencias: ['Microsoft 365'],
    });

    await expect(
      updateEmployeeFields('org-1', 'emp-1', { isActive: false }, 'user-1'),
    ).rejects.toMatchObject({
      code: 'EMPLOYEE_HAS_ACTIVE_ASSETS',
      httpStatus: 409,
      details: { equipos: ['TI-LAP-0001'], licencias: ['Microsoft 365'] },
    });
    expect(updateEmployeeMock).not.toHaveBeenCalled();
  });

  it('permite desactivar sin activos pendientes', async () => {
    findEmployeeActiveAssetSummaryMock.mockResolvedValue({ equipos: [], licencias: [] });
    updateEmployeeMock.mockResolvedValue({ count: 1 });
    findEmployeeWithPlacementSummaryMock.mockResolvedValue({ id: 'emp-1', fullName: 'A B' });

    const result = await updateEmployeeFields('org-1', 'emp-1', { isActive: false }, 'user-1');
    expect(result.kind).toBe('ok');
    expect(updateEmployeeMock).toHaveBeenCalled();
  });
});
