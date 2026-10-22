import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LicenseDomainError } from '@/modules/software-licenses/domain/errors';

const runLicenseTransactionMock = vi.fn();
const findOrganizationEmployeeMock = vi.fn();
const findSeatWithAssignmentsMock = vi.fn();
const findSubscriptionWithProductMock = vi.fn();

const storeState = {
  assignments: 0,
  lockQueue: Promise.resolve(),
};

function buildStore() {
  return {
    lockSeatForUpdate: vi.fn(async () => 'seat-1'),
    findSeatWithAssignmentsInTx: vi.fn(async () => ({
      id: 'seat-1',
      seatType: 'INDIVIDUAL',
      status: 'AVAILABLE',
      subscription: {
        organizationId: 'org-1',
        status: 'ACTIVE',
        renewalDate: new Date('2099-01-01'),
        expiringSoonDays: 30,
        product: { name: 'Producto X' },
      },
      assignments: storeState.assignments > 0 ? [{ id: 'a1', employeeId: 'other' }] : [],
    })),
    createAssignment: vi.fn(async () => {
      if (storeState.assignments > 0) {
        throw new LicenseDomainError('SEAT_NOT_ASSIGNABLE', 'El asiento no admite otra asignación.', 409);
      }
      storeState.assignments += 1;
      return { id: 'new-a' };
    }),
    updateSeat: vi.fn(async () => ({})),
    audit: vi.fn(async () => undefined),
    closeAssignment: vi.fn(),
    countActiveAssignmentsForSubscription: vi.fn(async () => 0),
    updateSubscription: vi.fn(async () => ({ product: { name: 'X' } })),
  };
}

vi.mock('@/modules/software-licenses/infrastructure/license-repository', () => ({
  runLicenseTransaction: (work: (store: ReturnType<typeof buildStore>) => Promise<unknown>) =>
    runLicenseTransactionMock(work),
  findOrganizationEmployee: (...args: unknown[]) => findOrganizationEmployeeMock(...args),
  findSeatWithAssignments: (...args: unknown[]) => findSeatWithAssignmentsMock(...args),
  findSubscriptionWithProduct: (...args: unknown[]) => findSubscriptionWithProductMock(...args),
  findSubscriptionWithSeatsAndProduct: vi.fn(),
  findSubscriptionDetail: vi.fn(),
  listSubscriptions: vi.fn(),
  listEmployeeNames: vi.fn(),
  upsertRenewalNotification: vi.fn(),
  findOpenAssignment: vi.fn(),
}));

const { assignSeat, updateSeat, updateSoftwareSubscription } = await import(
  '@/modules/software-licenses/application/service'
);

describe('assignSeat — integridad', () => {
  beforeEach(() => {
    storeState.assignments = 0;
    runLicenseTransactionMock.mockReset();
    findOrganizationEmployeeMock.mockReset();
    findOrganizationEmployeeMock.mockImplementation(async (employeeId: string) => ({
      id: employeeId,
      organizationId: 'org-1',
      isActive: true,
      fullName: employeeId === 'emp-1' ? 'Ana' : 'Bruno',
    }));
    runLicenseTransactionMock.mockImplementation(async (work) => {
      const store = buildStore();
      return storeState.lockQueue.then(async () => {
        storeState.lockQueue = new Promise<void>((resolve) => {
          setTimeout(resolve, 5);
        });
        return work(store);
      });
    });
  });

  it('rechaza suscripción no ACTIVE', async () => {
    runLicenseTransactionMock.mockImplementation(async (work) => {
      const store = buildStore();
      store.findSeatWithAssignmentsInTx.mockResolvedValue({
        id: 'seat-1',
        seatType: 'INDIVIDUAL',
        status: 'AVAILABLE',
        subscription: {
          organizationId: 'org-1',
          status: 'SUSPENDED',
          renewalDate: new Date('2099-01-01'),
          expiringSoonDays: 30,
          product: { name: 'Producto X' },
        },
        assignments: [],
      });
      return work(store);
    });

    await expect(assignSeat('seat-1', 'emp-1', 'org-1', 'user-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_NOT_ACTIVE',
      httpStatus: 409,
    });
  });

  it('rechaza suscripción vencida (display EXPIRED)', async () => {
    runLicenseTransactionMock.mockImplementation(async (work) => {
      const store = buildStore();
      store.findSeatWithAssignmentsInTx.mockResolvedValue({
        id: 'seat-1',
        seatType: 'INDIVIDUAL',
        status: 'AVAILABLE',
        subscription: {
          organizationId: 'org-1',
          status: 'ACTIVE',
          renewalDate: new Date('2020-01-01'),
          expiringSoonDays: 30,
          product: { name: 'Producto X' },
        },
        assignments: [],
      });
      return work(store);
    });

    await expect(assignSeat('seat-1', 'emp-1', 'org-1', 'user-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_EXPIRED',
      httpStatus: 409,
    });
  });

  it('dos assignSeat concurrentes en asiento INDIVIDUAL: solo uno tiene éxito', async () => {
    const results = await Promise.allSettled([
      assignSeat('seat-1', 'emp-1', 'org-1', 'user-1'),
      assignSeat('seat-1', 'emp-2', 'org-1', 'user-1'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});

describe('updateSeat — suspender/cancelar con asignaciones', () => {
  beforeEach(() => {
    findSeatWithAssignmentsMock.mockReset();
    runLicenseTransactionMock.mockReset();
  });

  it('409 si se cancela la suscripción con asignaciones activas', async () => {
    findSubscriptionWithProductMock.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      billingAmount: 10,
      renewalDate: new Date('2099-01-01'),
      productId: 'prod-1',
      product: { name: 'X' },
    });
    runLicenseTransactionMock.mockImplementation(async (work) => {
      const store = buildStore();
      store.countActiveAssignmentsForSubscription.mockResolvedValue(2);
      return work(store);
    });

    await expect(
      updateSoftwareSubscription('sub-1', { status: 'CANCELLED' }, 'org-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'SUBSCRIPTION_HAS_ACTIVE_ASSIGNMENTS',
      httpStatus: 409,
    });
  });

  it('409 si se suspende con asignaciones activas', async () => {
    findSeatWithAssignmentsMock.mockResolvedValue({
      id: 'seat-1',
      seatType: 'INDIVIDUAL',
      status: 'ASSIGNED',
      subscription: { organizationId: 'org-1', product: { name: 'X' } },
      assignments: [{ id: 'a1' }],
    });

    await expect(
      updateSeat('seat-1', { status: 'SUSPENDED' }, 'org-1', 'user-1'),
    ).rejects.toMatchObject({
      code: 'SEAT_HAS_ACTIVE_ASSIGNMENTS',
      httpStatus: 409,
    });
  });
});
