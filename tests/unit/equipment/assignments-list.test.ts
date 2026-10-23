import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAssignmentsMock = vi.fn();
const countAssignmentsMock = vi.fn();
const getAssignmentsPageSummaryMock = vi.fn();

vi.mock('@/modules/equipment/infrastructure/equipment-repository', () => ({
  listAssignments: (...args: unknown[]) => listAssignmentsMock(...args),
  countAssignments: (...args: unknown[]) => countAssignmentsMock(...args),
  getAssignmentsPageSummary: (...args: unknown[]) => getAssignmentsPageSummaryMock(...args),
  findAssignmentDetailBundle: vi.fn(),
  findAssignmentWithRelations: vi.fn(),
  assignEquipmentInTransaction: vi.fn(),
  returnAssignmentInTransaction: vi.fn(),
  swapAssignmentInTransaction: vi.fn(),
  updateAssignmentDocument: vi.fn(),
  findAssignmentById: vi.fn(),
  findActiveAssignmentForSwap: vi.fn(),
}));

describe('listEquipmentAssignments', () => {
  beforeEach(() => {
    listAssignmentsMock.mockReset();
    countAssignmentsMock.mockReset();
    listAssignmentsMock.mockResolvedValue([]);
    countAssignmentsMock.mockResolvedValue(0);
  });

  it('pagina y filtra por organización', async () => {
    const { listEquipmentAssignments } = await import('@/modules/equipment/application/assignment-service');
    const params = new URLSearchParams({
      tab: 'active',
      page: '2',
      pageSize: '20',
      search: 'IT-001',
    });

    await listEquipmentAssignments({ organizationId: 'org-1', searchParams: params });

    expect(listAssignmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', status: 'ACTIVE' }),
      20,
      20,
      expect.any(Object),
    );
    expect(countAssignmentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', status: 'ACTIVE' }),
    );
  });
});
