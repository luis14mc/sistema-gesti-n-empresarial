import { describe, expect, it } from 'vitest';
import { billingEquivalents, formatPaymentSchedule, parsePaymentText } from '@/lib/software-licenses/billing';
import { planLicenseImport } from '@/lib/software-licenses/import-rows';
import { renewalAlert, displaySubscriptionStatus } from '@/lib/software-licenses/renewals';
import {
  assertSameOrganization,
  canAssignSeat,
  canConvertToIndividual,
  effectiveSeatStatus,
  isAvailableSeat,
  summarizeSeats,
} from '@/lib/software-licenses/seats';
import { can, organizationRole } from '@/platform/security/authorization/permissions';
import { canAccessRoute, hasModuleAccess } from '@/lib/permissions';

const today = new Date('2026-10-01T00:00:00.000Z');

describe('software license seats', () => {
  it('keeps an individual seat occupied by one assignment', () => {
    const seat = { seatType: 'INDIVIDUAL' as const, status: 'ASSIGNED' as const, activeAssignments: 1 };
    expect(effectiveSeatStatus(seat)).toBe('ASSIGNED');
    expect(canAssignSeat(seat)).toBe(false);
    expect(isAvailableSeat({ ...seat, status: 'AVAILABLE', activeAssignments: 0 })).toBe(true);
  });

  it('counts a shared account as one occupied seat and two assigned users', () => {
    const shared = { seatType: 'SHARED' as const, status: 'ASSIGNED' as const, activeAssignments: 2 };
    const available = { seatType: 'INDIVIDUAL' as const, status: 'AVAILABLE' as const, activeAssignments: 0 };
    const summary = summarizeSeats([shared, available], 2);
    expect(summary.occupiedSeats).toBe(1);
    expect(summary.assignedUsers).toBe(2);
    expect(summary.sharedAccounts).toBe(1);
    expect(summary.availableSeats).toBe(1);
    expect(summary.unusedSeats).toBe(1);
  });

  it('keeps assignment history distinguishable from an active assignment', () => {
    const afterUnassign = { seatType: 'INDIVIDUAL' as const, status: 'ASSIGNED' as const, activeAssignments: 0 };
    expect(effectiveSeatStatus(afterUnassign)).toBe('AVAILABLE');
    expect(isAvailableSeat(afterUnassign)).toBe(true);
  });

  it('allows shared conversion back to individual only with one person or none', () => {
    expect(canConvertToIndividual({ seatType: 'SHARED', status: 'ASSIGNED', activeAssignments: 2 })).toBe(false);
    expect(canConvertToIndividual({ seatType: 'SHARED', status: 'ASSIGNED', activeAssignments: 1 })).toBe(true);
  });

  it('rejects an employee from another organization', () => {
    expect(() => assertSameOrganization('org-a', 'org-b')).toThrow('CROSS_ORGANIZATION_ASSIGNMENT');
    expect(() => assertSameOrganization('org-a', 'org-a')).not.toThrow();
  });
});

describe('software license billing and renewals', () => {
  it('converts monthly and annual amounts', () => {
    expect(billingEquivalents('MONTHLY', 750)).toEqual({ monthlyCost: 750, annualCost: 9000 });
    expect(billingEquivalents('ANNUAL', 1200)).toEqual({ monthlyCost: 100, annualCost: 1200 });
  });

  it('formats a monthly payment day', () => {
    expect(formatPaymentSchedule({ billingCycle: 'MONTHLY', paymentDay: 5 })).toBe('5 de cada mes');
    expect(parsePaymentText('05 de cada mes').paymentDay).toBe(5);
    expect(parsePaymentText('29 de cada mes').billingCycle).toBe('MONTHLY');
  });

  it('classifies 30, 15, 7 day and expired renewals', () => {
    expect(renewalAlert(new Date('2026-10-20T00:00:00.000Z'), today, 'ACTIVE')).toBe('IN_30_DAYS');
    expect(renewalAlert(new Date('2026-10-12T00:00:00.000Z'), today, 'ACTIVE')).toBe('IN_15_DAYS');
    expect(renewalAlert(new Date('2026-10-06T00:00:00.000Z'), today, 'ACTIVE')).toBe('IN_7_DAYS');
    expect(renewalAlert(new Date('2026-09-30T00:00:00.000Z'), today, 'ACTIVE')).toBe('EXPIRED');
    expect(displaySubscriptionStatus('ACTIVE', new Date('2026-10-20T00:00:00.000Z'), today)).toBe('EXPIRING_SOON');
    expect(displaySubscriptionStatus('ACTIVE', new Date('2026-09-01T00:00:00.000Z'), today)).toBe('EXPIRED');
  });
});

describe('excel shared-account import', () => {
  it('collapses repeated software and email into one shared seat', () => {
    const plan = planLicenseImport([
      { rowNumber: 2, software: 'ChatGPT', usuario: 'Aida Sandoval', correo: 'crivera@cni.hn', compartida: 'Sí', estado: 'Activo', fechaPago: '05 de cada mes' },
      { rowNumber: 3, software: 'ChatGPT', usuario: 'Carmen Rivera', correo: 'crivera@cni.hn', compartida: 'Sí', estado: 'Activo', fechaPago: '05 de cada mes' },
      { rowNumber: 4, software: 'ChatGPT', usuario: 'Luis Martinez', correo: 'soporteit@cni.hn', compartida: 'No', estado: 'Activo', fechaPago: '05 de cada mes' },
      { rowNumber: 5, software: 'ChatGPT', usuario: '', correo: '', compartida: 'No', estado: 'Disponible', fechaPago: '05 de cada mes' },
    ]);
    expect(plan.products).toHaveLength(1);
    expect(plan.products[0].seats).toHaveLength(3);
    const shared = plan.products[0].seats.find((seat) => seat.accountEmail === 'crivera@cni.hn');
    expect(shared?.seatType).toBe('SHARED');
    expect(shared?.assignments.map((assignment) => assignment.employeeName)).toEqual(['Aida Sandoval', 'Carmen Rivera']);
    expect(plan.products[0].seats.filter((seat) => seat.status === 'AVAILABLE')).toHaveLength(1);
  });
});

describe('software license access', () => {
  it('grants ADMIN and IT_MANAGER and denies ADMINISTRACION and SECRETARIA', () => {
    expect(can(organizationRole('ADMIN'), 'software-licenses.manage')).toBe(true);
    expect(can(organizationRole('IT_MANAGER'), 'software-licenses.assign')).toBe(true);
    expect(can(organizationRole('IT_MANAGER'), 'software-licenses.export')).toBe(true);
    expect(can(organizationRole('ADMINISTRACION'), 'software-licenses.read')).toBe(false);
    expect(can(organizationRole('SECRETARIA'), 'software-licenses.read')).toBe(false);
    expect(hasModuleAccess('IT_MANAGER', 'software-licenses')).toBe(true);
    expect(hasModuleAccess('ADMINISTRACION', 'software-licenses')).toBe(false);
    expect(hasModuleAccess('SECRETARIA', 'software-licenses')).toBe(false);
    expect(canAccessRoute('ADMINISTRACION', '/ti/licencias')).toBe(false);
    expect(canAccessRoute('SECRETARIA', '/ti/licencias/asignaciones')).toBe(false);
    expect(canAccessRoute('IT_MANAGER', '/ti/licencias')).toBe(true);
    expect(canAccessRoute('ADMIN', '/ti/licencias/asignaciones')).toBe(true);
  });
});
