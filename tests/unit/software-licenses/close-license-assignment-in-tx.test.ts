import { describe, expect, it, vi } from 'vitest';

const store = {
  closeAssignment: vi.fn().mockResolvedValue({}),
  audit: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/modules/software-licenses/infrastructure/license-repository', () => ({
  createLicenseStore: vi.fn(() => store),
}));

import { closeLicenseAssignmentInTransaction } from '@/modules/software-licenses/infrastructure/close-license-assignment-in-tx';

describe('closeLicenseAssignmentInTransaction', () => {
  it('registra SEAT_UNASSIGNED con motivo de terminación laboral', async () => {
    const tx = {
      licenseAssignment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'lic-asg-1',
          employee: { fullName: 'Ana Ficticia' },
          seat: {
            seatType: 'INDIVIDUAL',
            subscription: { product: { name: 'Microsoft 365' } },
          },
        }),
      },
    };

    await closeLicenseAssignmentInTransaction(tx as never, {
      organizationId: 'org-1',
      assignmentId: 'lic-asg-1',
      userId: 'user-1',
      reason: 'Terminación de relación laboral',
    });

    expect(store.closeAssignment).toHaveBeenCalledWith('lic-asg-1', 'user-1');
    expect(store.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SEAT_UNASSIGNED',
        description: expect.stringContaining('Terminación de relación laboral'),
      }),
    );
  });
});
