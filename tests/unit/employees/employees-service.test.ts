import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeDuplicateFieldError, EmployeeHasHistoryError } from '@/modules/people/domain/errors';

vi.mock('@/modules/people/infrastructure/employee-repository', () => ({
  findEmployee: vi.fn(),
  findEmployeeWithPlacementSummary: vi.fn(),
  updateEmployee: vi.fn(),
  createEmployeeWithPlacement: vi.fn(),
  findActiveDepartmentAndPosition: vi.fn(),
  countEmployeeHistory: vi.fn(),
  deleteEmployeeById: vi.fn(),
  knownPrismaErrorCode: vi.fn((error: unknown) =>
    (error as { code?: string }).code === 'P2002' ? 'P2002' : null,
  ),
  findEmployeeActiveAssetSummary: vi.fn(),
}));

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(),
}));

vi.mock('@/modules/people/infrastructure/employee-assets', () => ({
  findEmployeeActiveAssetsDetail: vi.fn(),
}));

import {
  updateEmployeeFields,
  deleteEmployeeRecord,
} from '@/modules/people/application/employees-service';
import {
  findEmployee,
  updateEmployee,
  findEmployeeWithPlacementSummary,
  countEmployeeHistory,
  deleteEmployeeById,
} from '@/modules/people/infrastructure/employee-repository';
import { createAuditRecord } from '@/platform/security/audit/audit-record';

const orgId = 'org-1';
const actor = 'user-1';

describe('updateEmployeeFields', () => {
  beforeEach(() => {
    vi.mocked(findEmployee).mockResolvedValue({
      id: 'e1',
      organizationId: orgId,
      firstName: 'Ana',
      lastName: 'Pérez',
      fullName: 'Ana Pérez',
      email: 'ana@test.com',
      employeeCode: 'E001',
      phone: null,
      dni: null,
      hireDate: new Date('2020-01-01'),
      departmentId: 'd1',
      positionId: 'p1',
      isActive: true,
      userId: null,
    } as Awaited<ReturnType<typeof findEmployee>>);
    vi.mocked(updateEmployee).mockResolvedValue({ count: 1 });
    vi.mocked(findEmployeeWithPlacementSummary).mockResolvedValue({
      id: 'e1',
      fullName: 'Ana Pérez',
    } as Awaited<ReturnType<typeof findEmployeeWithPlacementSummary>>);
  });

  it('updates phone and normalized dni', async () => {
    const result = await updateEmployeeFields(orgId, 'e1', { phone: '9999-9999', dni: '0801199012345' }, actor);
    expect(result.kind).toBe('ok');
    expect(updateEmployee).toHaveBeenCalledWith(
      orgId,
      'e1',
      expect.objectContaining({ phone: '9999-9999', dni: '0801-1990-12345' }),
    );
  });

  it('throws duplicate email conflict', async () => {
    const duplicate = new EmployeeDuplicateFieldError('email');
    vi.mocked(updateEmployee).mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['email'] } }),
    );
    await expect(
      updateEmployeeFields(orgId, 'e1', { email: 'dup@test.com' }, actor),
    ).rejects.toBeInstanceOf(EmployeeDuplicateFieldError);
  });
});

describe('deleteEmployeeRecord', () => {
  beforeEach(() => {
    vi.mocked(findEmployee).mockResolvedValue({
      id: 'e1',
      fullName: 'Ana Pérez',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@test.com',
      employeeCode: 'E001',
    } as Awaited<ReturnType<typeof findEmployee>>);
    vi.mocked(createAuditRecord).mockResolvedValue({} as Awaited<ReturnType<typeof createAuditRecord>>);
  });

  it('deletes when no history', async () => {
    vi.mocked(countEmployeeHistory).mockResolvedValue({
      assignments: 0,
      licenseAssignments: 0,
      payslips: 0,
      oficios: 0,
      purchaseOrders: 0,
      linkedUser: false,
    });
    vi.mocked(deleteEmployeeById).mockResolvedValue(true);

    const result = await deleteEmployeeRecord(orgId, 'e1', actor);
    expect(result.kind).toBe('ok');
    expect(deleteEmployeeById).toHaveBeenCalled();
  });

  it('rejects delete with history detail', async () => {
    vi.mocked(countEmployeeHistory).mockResolvedValue({
      assignments: 2,
      licenseAssignments: 0,
      payslips: 3,
      oficios: 0,
      purchaseOrders: 0,
      linkedUser: false,
    });

    await expect(deleteEmployeeRecord(orgId, 'e1', actor)).rejects.toBeInstanceOf(EmployeeHasHistoryError);
  });
});
