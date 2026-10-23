import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LicenseDomainError } from '@/modules/software-licenses/domain/errors';

const runLicenseTransactionMock = vi.fn();
const findSeatWithAssignmentsMock = vi.fn();
const findSubscriptionWithSeatsAndProductMock = vi.fn();
const listSubscriptionsMock = vi.fn();

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(async () => undefined),
}));

function buildDeleteStore(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    lockSeatForUpdate: vi.fn(async () => 'seat-1'),
    findSeatWithAssignmentsInTx: vi.fn(async () => ({
      id: 'seat-1',
      assignments: [],
      subscription: { product: { name: 'App' }, organizationId: 'org-1' },
    })),
    countAssignmentHistoryForSeat: vi.fn(async () => 0),
    deleteSeatPhysical: vi.fn(async () => undefined),
    updateSeat: vi.fn(async () => ({ id: 'seat-1', status: 'CANCELLED' })),
    audit: vi.fn(async () => undefined),
    lockSubscriptionForUpdate: vi.fn(async () => 'sub-1'),
    countActiveAssignmentsForSubscription: vi.fn(async () => 0),
    countAssignmentHistoryForSubscription: vi.fn(async () => 0),
    deleteSubscriptionPhysical: vi.fn(async () => undefined),
    updateSubscription: vi.fn(async () => ({ id: 'sub-1', status: 'CANCELLED', product: { name: 'App' } })),
    cancelAllSeatsForSubscription: vi.fn(async () => ({ count: 1 })),
    ...overrides,
  };
}

vi.mock('@/modules/software-licenses/infrastructure/license-repository', () => ({
  runLicenseTransaction: (work: (store: ReturnType<typeof buildDeleteStore>) => Promise<unknown>) =>
    runLicenseTransactionMock(work),
  findSeatWithAssignments: (...args: unknown[]) => findSeatWithAssignmentsMock(...args),
  findSubscriptionWithSeatsAndProduct: (...args: unknown[]) => findSubscriptionWithSeatsAndProductMock(...args),
  listSubscriptions: (...args: unknown[]) => listSubscriptionsMock(...args),
  findSubscriptionDetail: vi.fn(),
  findOrganizationEmployee: vi.fn(),
  findOpenAssignment: vi.fn(),
  findOrganizationEquipment: vi.fn(),
  listDeviceLicensesForEquipment: vi.fn(),
  listEmployeeNames: vi.fn(),
  listOrganizationEquipmentCodes: vi.fn(),
  upsertRenewalNotification: vi.fn(),
  findSubscriptionWithProduct: vi.fn(),
}));

describe('deleteSeat', () => {
  beforeEach(() => {
    runLicenseTransactionMock.mockReset();
    findSeatWithAssignmentsMock.mockReset();
  });

  it('borra físicamente cuando no hay historial de asignaciones', async () => {
    findSeatWithAssignmentsMock.mockResolvedValue({
      id: 'seat-1',
      status: 'AVAILABLE',
      seatType: 'INDIVIDUAL',
      licenseKey: 'secret',
      assignments: [],
      subscription: { product: { name: 'App' }, organizationId: 'org-1' },
    });
    const store = buildDeleteStore();
    runLicenseTransactionMock.mockImplementation(async (work) => work(store));

    const { deleteSeat } = await import('@/modules/software-licenses/application/service');
    const result = await deleteSeat('seat-1', 'org-1', 'user-1');

    expect(result.outcome).toBe('DELETED');
    expect(store.deleteSeatPhysical).toHaveBeenCalledWith('seat-1');
    expect(store.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SEAT_DELETED', previousData: expect.not.objectContaining({ licenseKey: 'secret' }) }),
    );
  });

  it('da de baja cuando hubo asignaciones en el pasado', async () => {
    findSeatWithAssignmentsMock.mockResolvedValue({
      id: 'seat-1',
      status: 'AVAILABLE',
      seatType: 'INDIVIDUAL',
      licenseKey: null,
      assignments: [],
      subscription: { product: { name: 'App' }, organizationId: 'org-1' },
    });
    const store = buildDeleteStore({
      countAssignmentHistoryForSeat: vi.fn(async () => 2),
    });
    runLicenseTransactionMock.mockImplementation(async (work) => work(store));

    const { deleteSeat } = await import('@/modules/software-licenses/application/service');
    const result = await deleteSeat('seat-1', 'org-1', 'user-1');

    expect(result.outcome).toBe('CANCELLED');
    expect(store.updateSeat).toHaveBeenCalledWith('seat-1', { status: 'CANCELLED', equipmentId: null });
    expect(store.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'SEAT_CANCELLED' }));
  });

  it('409 LICENSE_IN_USE con asignación activa', async () => {
    findSeatWithAssignmentsMock.mockResolvedValue({
      id: 'seat-1',
      assignments: [{ id: 'a1' }],
      subscription: { product: { name: 'App' }, organizationId: 'org-1' },
    });

    const { deleteSeat } = await import('@/modules/software-licenses/application/service');
    await expect(deleteSeat('seat-1', 'org-1', 'user-1')).rejects.toMatchObject({
      code: 'LICENSE_IN_USE',
      httpStatus: 409,
    });
  });

  it('404 cuando el asiento es de otra organización', async () => {
    findSeatWithAssignmentsMock.mockResolvedValue(null);

    const { deleteSeat } = await import('@/modules/software-licenses/application/service');
    await expect(deleteSeat('seat-1', 'org-other', 'user-1')).rejects.toMatchObject({
      code: 'SEAT_NOT_FOUND',
      httpStatus: 404,
    });
  });
});

describe('deleteSoftwareSubscription', () => {
  beforeEach(() => {
    runLicenseTransactionMock.mockReset();
    findSubscriptionWithSeatsAndProductMock.mockReset();
  });

  it('elimina físicamente cuando ningún asiento tuvo asignaciones', async () => {
    findSubscriptionWithSeatsAndProductMock.mockResolvedValue({
      id: 'sub-1',
      planName: 'Plan',
      status: 'ACTIVE',
      productId: 'prod-1',
      product: { name: 'App' },
      seats: [{ id: 's1' }],
    });
    const store = buildDeleteStore();
    runLicenseTransactionMock.mockImplementation(async (work) => work(store));

    const { deleteSoftwareSubscription } = await import('@/modules/software-licenses/application/service');
    const result = await deleteSoftwareSubscription('sub-1', 'org-1', 'user-1');

    expect(result.outcome).toBe('DELETED');
    expect(store.deleteSubscriptionPhysical).toHaveBeenCalledWith('sub-1');
  });

  it('cancela suscripción y asientos cuando hubo historial', async () => {
    findSubscriptionWithSeatsAndProductMock.mockResolvedValue({
      id: 'sub-1',
      planName: 'Plan',
      status: 'ACTIVE',
      productId: 'prod-1',
      product: { name: 'App' },
      seats: [{ id: 's1' }],
    });
    const store = buildDeleteStore({
      countAssignmentHistoryForSubscription: vi.fn(async () => 1),
    });
    runLicenseTransactionMock.mockImplementation(async (work) => work(store));

    const { deleteSoftwareSubscription } = await import('@/modules/software-licenses/application/service');
    const result = await deleteSoftwareSubscription('sub-1', 'org-1', 'user-1');

    expect(result.outcome).toBe('CANCELLED');
    expect(store.cancelAllSeatsForSubscription).toHaveBeenCalledWith('sub-1');
  });

  it('409 SUBSCRIPTION_IN_USE con conteo de asignaciones activas', async () => {
    findSubscriptionWithSeatsAndProductMock.mockResolvedValue({
      id: 'sub-1',
      planName: 'Plan',
      status: 'ACTIVE',
      productId: 'prod-1',
      product: { name: 'App' },
      seats: [],
    });
    const store = buildDeleteStore({
      countActiveAssignmentsForSubscription: vi.fn(async () => 3),
    });
    runLicenseTransactionMock.mockImplementation(async (work) => work(store));

    const { deleteSoftwareSubscription } = await import('@/modules/software-licenses/application/service');
    await expect(deleteSoftwareSubscription('sub-1', 'org-1', 'user-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_IN_USE',
      httpStatus: 409,
      message: expect.stringContaining('3'),
    });
  });
});

describe('listado y KPIs sin canceladas', () => {
  beforeEach(() => {
    listSubscriptionsMock.mockReset();
  });

  it('licenseDashboard excluye suscripciones CANCELLED de costos', async () => {
    const today = new Date('2026-06-01T12:00:00.000Z');
    listSubscriptionsMock.mockResolvedValue([
      {
        id: 'active',
        organizationId: 'org-1',
        status: 'ACTIVE',
        productId: 'p1',
        product: { name: 'A', vendor: null, active: true },
        planName: 'Plan',
        currency: 'USD',
        monthlyCost: 100,
        annualCost: 1200,
        billingAmount: 100,
        totalSeats: 5,
        renewalDate: new Date('2099-01-01'),
        expiringSoonDays: 30,
        billingCycle: 'MONTHLY',
        seats: [],
      },
      {
        id: 'cancelled',
        organizationId: 'org-1',
        status: 'CANCELLED',
        productId: 'p2',
        product: { name: 'B', vendor: null, active: true },
        planName: 'Plan',
        currency: 'USD',
        monthlyCost: 500,
        annualCost: 6000,
        billingAmount: 500,
        totalSeats: 10,
        renewalDate: null,
        expiringSoonDays: 30,
        billingCycle: 'MONTHLY',
        seats: [],
      },
    ]);

    const { licenseDashboard, listSoftwareSubscriptions } = await import(
      '@/modules/software-licenses/application/service'
    );
    const dashboard = await licenseDashboard('org-1', today);
    expect(dashboard.costs.USD?.monthlyCost).toBe(100);

    const listed = await listSoftwareSubscriptions('org-1', {}, today);
    expect(listed.map((item) => item.id)).toEqual(['active']);

    const cancelledOnly = await listSoftwareSubscriptions('org-1', { status: 'CANCELLED' }, today);
    expect(cancelledOnly.map((item) => item.id)).toEqual(['cancelled']);
  });
});
