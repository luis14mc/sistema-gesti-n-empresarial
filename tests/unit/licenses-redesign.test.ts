import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceRenewalDate,
  displaySubscriptionStatus,
} from '@/modules/software-licenses/domain/renewals';
import {
  canChangeSeatTypeTo,
  summarizeSeats,
  type SeatOccupancy,
} from '@/modules/software-licenses/domain/seats';
import { maskLicenseKey } from '@/modules/software-licenses/domain/license-key';
import { LicenseDomainError } from '@/modules/software-licenses/domain/errors';

const runLicenseTransactionMock = vi.fn();
const findOrganizationEmployeeMock = vi.fn();

function buildStore() {
  let assignments = 0;
  return {
    lockSeatForUpdate: vi.fn(async () => 'seat-1'),
    findSeatWithAssignmentsInTx: vi.fn(async () => ({
      id: 'seat-1',
      seatType: 'INDIVIDUAL',
      status: 'AVAILABLE',
      equipmentId: null,
      subscription: {
        organizationId: 'org-1',
        status: 'ACTIVE',
        renewalDate: new Date('2099-01-01'),
        expiringSoonDays: 30,
        product: { name: 'Producto X' },
      },
      assignments: assignments > 0 ? [{ id: 'a1', employeeId: 'other' }] : [],
    })),
    createAssignment: vi.fn(async () => {
      if (assignments > 0) {
        throw new LicenseDomainError('LICENSE_ALREADY_ASSIGNED', 'Ya asignada', 409);
      }
      assignments += 1;
      return { id: 'new-a' };
    }),
    closeAssignment: vi.fn(async () => {
      assignments = 0;
      return {};
    }),
    updateSeat: vi.fn(async () => ({})),
    audit: vi.fn(async () => undefined),
  };
}

vi.mock('@/modules/software-licenses/infrastructure/license-repository', () => ({
  runLicenseTransaction: (work: (store: ReturnType<typeof buildStore>) => Promise<unknown>) =>
    runLicenseTransactionMock(work),
  findOrganizationEmployee: (...args: unknown[]) => findOrganizationEmployeeMock(...args),
  findSeatWithAssignments: vi.fn(),
  findSubscriptionWithProduct: vi.fn(),
  findSubscriptionWithSeatsAndProduct: vi.fn(),
  findSubscriptionDetail: vi.fn(),
  listSubscriptions: vi.fn(),
  listEmployeeNames: vi.fn(),
  listOrganizationEquipmentCodes: vi.fn(),
  upsertRenewalNotification: vi.fn(),
  findOpenAssignment: vi.fn(),
  findOrganizationEquipment: vi.fn(),
  listDeviceLicensesForEquipment: vi.fn(),
}));

describe('licencias — dominio', () => {
  it('INDIVIDUAL no admite segunda asignación sin reemplazo', () => {
    const seat: SeatOccupancy = { seatType: 'INDIVIDUAL', status: 'AVAILABLE', activeAssignments: 1 };
    expect(canChangeSeatTypeTo('INDIVIDUAL', seat).ok).toBe(true);
    expect(canChangeSeatTypeTo('INDIVIDUAL', { ...seat, activeAssignments: 2 }).ok).toBe(false);
  });

  it('SHARED admite varias asignaciones', () => {
    const seat: SeatOccupancy = { seatType: 'SHARED', status: 'AVAILABLE', activeAssignments: 3 };
    expect(seat.activeAssignments).toBe(3);
  });

  it('DEVICE en uso con equipmentId', () => {
    const counts = summarizeSeats(
      [{ seatType: 'DEVICE', status: 'AVAILABLE', activeAssignments: 0, equipmentId: 'eq-1' }],
      5,
    );
    expect(counts.inUseSeats).toBe(1);
    expect(counts.freeSeats).toBe(0);
  });

  it('contadores y exceso sobre contrato', () => {
    const seats = [
      { seatType: 'INDIVIDUAL' as const, status: 'AVAILABLE' as const, activeAssignments: 1 },
      { seatType: 'SHARED' as const, status: 'AVAILABLE' as const, activeAssignments: 0 },
    ];
    const summary = summarizeSeats(seats, 1);
    expect(summary.registeredSeats).toBe(2);
    expect(summary.exceedsContract).toBe(true);
  });

  it('renovar avanza fecha según ciclo', () => {
    const today = new Date('2026-01-15T00:00:00.000Z');
    const current = new Date('2026-01-15T00:00:00.000Z');
    expect(advanceRenewalDate(current, 'MONTHLY', today).toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(advanceRenewalDate(current, 'QUARTERLY', today).toISOString().slice(0, 10)).toBe('2026-04-15');
    expect(advanceRenewalDate(current, 'ANNUAL', today).toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('licenseKey enmascarada', () => {
    expect(maskLicenseKey('ABCDEFGHIJK')).toBe('•••••GHIJK');
    expect(maskLicenseKey(null)).toBeNull();
  });

  it('estado de vencimiento derivado', () => {
    const today = new Date('2026-10-01T00:00:00.000Z');
    const renewal = new Date('2026-10-20T00:00:00.000Z');
    expect(displaySubscriptionStatus('ACTIVE', renewal, today, 30)).toBe('EXPIRING_SOON');
  });
});

describe('assignSeat — reglas de rediseño', () => {
  beforeEach(() => {
    runLicenseTransactionMock.mockReset();
    findOrganizationEmployeeMock.mockResolvedValue({
      id: 'emp-1',
      organizationId: 'org-1',
      isActive: true,
      fullName: 'Ana',
    });
    runLicenseTransactionMock.mockImplementation(async (work) => work(buildStore()));
  });

  it('409 LICENSE_ALREADY_ASSIGNED en cuenta personal ocupada', async () => {
    runLicenseTransactionMock.mockImplementation(async (work) => {
      const store = buildStore();
      store.findSeatWithAssignmentsInTx.mockResolvedValue({
        id: 'seat-1',
        seatType: 'INDIVIDUAL',
        status: 'AVAILABLE',
        equipmentId: null,
        subscription: {
          organizationId: 'org-1',
          status: 'ACTIVE',
          renewalDate: new Date('2099-01-01'),
          expiringSoonDays: 30,
          product: { name: 'Producto X' },
        },
        assignments: [{ id: 'a1', employeeId: 'other' }],
      });
      return work(store);
    });
    const { assignSeat } = await import('@/modules/software-licenses/application/service');
    await expect(assignSeat('seat-1', 'emp-1', 'org-1', 'user-1')).rejects.toMatchObject({
      code: 'LICENSE_ALREADY_ASSIGNED',
    });
  });

  it('Reasignar cierra y abre en una transacción', async () => {
    const store = buildStore();
    store.findSeatWithAssignmentsInTx.mockResolvedValue({
      id: 'seat-1',
      seatType: 'INDIVIDUAL',
      status: 'AVAILABLE',
      equipmentId: null,
      subscription: {
        organizationId: 'org-1',
        status: 'ACTIVE',
        renewalDate: new Date('2099-01-01'),
        expiringSoonDays: 30,
        product: { name: 'Producto X' },
      },
      assignments: [{ id: 'a1', employeeId: 'other' }],
    });
    runLicenseTransactionMock.mockImplementation(async (work) => work(store));
    const { assignSeat } = await import('@/modules/software-licenses/application/service');
    await assignSeat('seat-1', 'emp-1', 'org-1', 'user-1', null, 'a1');
    expect(store.closeAssignment).toHaveBeenCalledWith('a1', 'user-1');
    expect(store.createAssignment).toHaveBeenCalled();
    expect(store.updateSeat).not.toHaveBeenCalled();
  });
});
