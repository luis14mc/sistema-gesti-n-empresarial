import { describe, expect, it } from 'vitest';
import { expectGolden, importFirst } from './_helpers';

/** Rutas destino (fase 5) primero; las de origen quedan como respaldo. */
const billing = await importFirst<GoldenModule>([
  'src/modules/software-licenses/domain/billing.ts',
  'src/lib/software-licenses/billing.ts',
]);
const seats = await importFirst<GoldenModule>([
  'src/modules/software-licenses/domain/seats.ts',
  'src/lib/software-licenses/seats.ts',
]);
const renewals = await importFirst<GoldenModule>([
  'src/modules/software-licenses/domain/renewals.ts',
  'src/lib/software-licenses/renewals.ts',
]);
const importRows = await importFirst<GoldenModule>([
  'src/modules/software-licenses/domain/import-rows.ts',
  'src/lib/software-licenses/import-rows.ts',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoldenModule = Record<string, any>;

const eq = (a: unknown, b: unknown) => expect(a).toEqual(b);

describe('platform golden — software-licenses (cálculos puros)', () => {
  it('billing', () => {
    const amounts = [0, 9.99, 20, 100, 1234.567];
    const equivalents: Record<string, unknown> = {};
    for (const cycle of billing.SOFTWARE_BILLING_CYCLES as string[]) {
      equivalents[cycle] = amounts.map((amount) => billing.billingEquivalents(cycle, amount));
    }
    const schedules = [
      { billingCycle: 'MONTHLY', paymentDay: 5 },
      { billingCycle: 'QUARTERLY', paymentDay: 15 },
      { billingCycle: 'ANNUAL', paymentDay: 1 },
      { billingCycle: 'ANNUAL', paymentDay: 1, renewalDate: '2026-12-31' },
      { billingCycle: 'OTHER', renewalDate: new Date('2027-02-28T00:00:00.000Z') },
      { billingCycle: 'OTHER', renewalDate: 'no-es-fecha' },
      { billingCycle: 'MONTHLY', paymentDay: null },
    ].map((input) => billing.formatPaymentSchedule(input));
    const parsed = ['5 de cada mes', '31 cada mes', '32 de cada mes', '2026-12-31', 'mañana', '', null].map((text) =>
      billing.parsePaymentText(text),
    );
    expectGolden(
      'software-licenses',
      'billing',
      {
        cycles: billing.SOFTWARE_BILLING_CYCLES,
        currencies: billing.SOFTWARE_CURRENCIES,
        roundMoney: [1.005, 2.675, 10, 0.1 + 0.2].map(billing.roundMoney),
        equivalents,
        schedules,
        parsed,
      },
      eq,
    );
  });

  it('seats', () => {
    const cases = [
      { seatType: 'INDIVIDUAL', status: 'AVAILABLE', activeAssignments: 0 },
      { seatType: 'INDIVIDUAL', status: 'AVAILABLE', activeAssignments: 1 },
      { seatType: 'SHARED', status: 'ASSIGNED', activeAssignments: 3 },
      { seatType: 'SHARED', status: 'ASSIGNED', activeAssignments: 1 },
      { seatType: 'SHARED', status: 'SUSPENDED', activeAssignments: 2 },
      { seatType: 'INDIVIDUAL', status: 'CANCELLED', activeAssignments: 1 },
      { seatType: 'SHARED', status: 'AVAILABLE', activeAssignments: 0 },
    ];
    const perSeat = cases.map((seat) => ({
      effective: seats.effectiveSeatStatus(seat),
      occupied: seats.isOccupiedSeat(seat),
      available: seats.isAvailableSeat(seat),
      shared: seats.isSharedAccount(seat),
      canAssign: seats.canAssignSeat(seat),
      canConvertToIndividual: seats.canConvertToIndividual(seat),
    }));
    let crossOrg: string | null = null;
    try {
      seats.assertSameOrganization('org-a', 'org-b');
    } catch (error) {
      crossOrg = (error as Error).message;
    }
    expectGolden(
      'software-licenses',
      'seats',
      {
        types: seats.SEAT_TYPES,
        statuses: seats.SEAT_STATUSES,
        perSeat,
        summary: seats.summarizeSeats(cases, 10),
        summaryOverbooked: seats.summarizeSeats(cases, 1),
        crossOrg,
      },
      eq,
    );
  });

  it('renewals', () => {
    const today = new Date('2026-10-15T18:00:00.000Z');
    const offsets = [-10, -1, 0, 1, 7, 8, 15, 16, 30, 31, 365];
    const dates = offsets.map((days) => new Date(Date.UTC(2026, 9, 15 + days, 3, 0, 0)));
    const statuses: Array<'ACTIVE' | 'SUSPENDED' | 'CANCELLED'> = ['ACTIVE', 'SUSPENDED', 'CANCELLED'];
    const table = statuses.map((status) => ({
      status,
      alerts: [null, ...dates].map((d) => renewals.renewalAlert(d, today, status)),
      display: [null, ...dates].map((d) => renewals.displaySubscriptionStatus(status, d, today)),
      display7: [null, ...dates].map((d) => renewals.displaySubscriptionStatus(status, d, today, 7)),
    }));
    expectGolden(
      'software-licenses',
      'renewals',
      {
        defaultDays: renewals.DEFAULT_EXPIRING_SOON_DAYS,
        daysUntil: dates.map((d) => renewals.calendarDaysUntil(d, today)),
        table,
      },
      eq,
    );
  });

  it('import-rows (plan y validación)', () => {
    const row = (rowNumber: number, values: Partial<Record<'software' | 'usuario' | 'correo' | 'compartida' | 'estado' | 'fechaPago', string>>) => ({
      rowNumber,
      software: '',
      usuario: '',
      correo: '',
      compartida: '',
      estado: '',
      fechaPago: '',
      ...values,
    });
    const plan = importRows.planLicenseImport([
      row(2, { software: 'Microsoft 365', usuario: 'Ana López', correo: 'ana@cni.hn', estado: 'Activo', fechaPago: '5 de cada mes' }),
      row(3, { software: 'microsoft 365', usuario: 'Luis Pérez', correo: 'compartida@cni.hn', compartida: 'Sí', fechaPago: '10 de cada mes' }),
      row(4, { software: 'Microsoft 365', usuario: 'María Díaz', correo: 'COMPARTIDA@cni.hn' }),
      row(5, { software: 'Microsoft 365', usuario: 'María Díaz', correo: 'compartida@cni.hn' }),
      row(6, { software: '', usuario: 'Sin software', correo: 'x@cni.hn' }),
      row(7, { software: 'Adobe CC', usuario: '', correo: 'adobe@cni.hn', estado: 'Disponible', fechaPago: '2026-12-31' }),
      row(8, { software: 'Adobe CC', usuario: 'Carlos', correo: 'adobe2@cni.hn', estado: 'Cancelado' }),
      row(9, { software: 'Adobe CC', usuario: 'Pedro', correo: 'adobe3@cni.hn', estado: 'Suspendida' }),
      row(10, { software: 'Zoom', usuario: 'Ana López', correo: '', compartida: 'no', fechaPago: 'algún día' }),
      row(11, { software: 'Zoom', usuario: 'Luis Pérez', correo: '' }),
      row(12, { software: 'Slack', usuario: 'Ana López', correo: 'slack@cni.hn', estado: 'available' }),
      row(13, { software: 'Slack', usuario: 'Luis Pérez', correo: 'slack@cni.hn' }),
    ]);
    expectGolden('software-licenses', 'importPlan', plan, eq);
  });
});
