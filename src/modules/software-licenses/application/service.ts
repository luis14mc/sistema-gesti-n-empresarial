import { Prisma } from '@prisma/client';
import {
  findOpenAssignment,
  findOrganizationEmployee,
  findOrganizationEquipment,
  findSeatWithAssignments,
  listDeviceLicensesForEquipment,
  findSubscriptionDetail,
  findSubscriptionWithProduct,
  findSubscriptionWithSeatsAndProduct,
  listEmployeeNames,
  listOrganizationEquipmentCodes,
  listSubscriptions,
  runLicenseTransaction,
  upsertRenewalNotification,
} from '@/modules/software-licenses/infrastructure/license-repository';
import { billingEquivalents } from '@/modules/software-licenses/domain/billing';
import { planLicenseImport, type LicenseImportRow } from '@/modules/software-licenses/domain/import-rows';
import { renewalAlert, displaySubscriptionStatus } from '@/modules/software-licenses/domain/renewals';
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from '@/modules/software-licenses/presentation/schemas';
import {
  assertSameOrganization,
  assertSeatFields,
  canAssignSeat,
  canChangeSeatTypeTo,
  effectiveSeatStatus,
  summarizeSeats,
  unitMonthlyCost,
  type SeatOccupancy,
} from '@/modules/software-licenses/domain/seats';
import { maskLicenseKey } from '@/modules/software-licenses/domain/license-key';
import { advanceRenewalDate } from '@/modules/software-licenses/domain/renewals';
import {
  LicenseDomainError,
  seatBlockedWithAssignmentsError,
  subscriptionCancelBlockedError,
  subscriptionNotAssignableError,
} from '@/modules/software-licenses/domain/errors';

function money(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createSoftwareSubscription(input: CreateSubscriptionInput, organizationId: string, userId: string) {
  const costs = billingEquivalents(input.billingCycle, input.billingAmount);
  return runLicenseTransaction(async (store) => {
    const product = await store.upsertProduct({
      where: { organizationId_name: { organizationId, name: input.productName } },
      update: {
        vendor: input.vendor || undefined,
        category: input.category || undefined,
        description: input.description || undefined,
        website: input.website || undefined,
        active: true,
      },
      create: {
        organizationId,
        name: input.productName,
        vendor: input.vendor || null,
        category: input.category || null,
        description: input.description || null,
        website: input.website || null,
      },
    });
    const subscription = await store.createSubscriptionWithSeats({
        organizationId,
        productId: product.id,
        planName: input.planName,
        totalSeats: input.totalSeats,
        billingCycle: input.billingCycle,
        currency: input.currency,
        billingAmount: money(input.billingAmount),
        monthlyCost: money(costs.monthlyCost),
        annualCost: money(costs.annualCost),
        startDate: dateOnly(input.startDate),
        renewalDate: input.renewalDate ? dateOnly(input.renewalDate) : null,
        paymentDay: input.paymentDay ?? null,
        autoRenew: input.autoRenew,
        notes: input.notes || null,
        expiringSoonDays: input.expiringSoonDays,
        createdById: userId,
    });
    await store.audit({
      organizationId, userId, action: 'SUBSCRIPTION_CREATED', entityId: subscription.id, entityType: 'SoftwareSubscription',
      title: 'Suscripción creada', description: `${product.name} · ${input.planName}`, newData: { totalSeats: input.totalSeats, billingAmount: input.billingAmount },
    });
    return subscription;
  });
}

export async function updateSoftwareSubscription(id: string, input: UpdateSubscriptionInput, organizationId: string, userId: string) {
  const existing = await findSubscriptionWithProduct(id, organizationId);
  if (!existing) throw new Error('SUBSCRIPTION_NOT_FOUND');
  const billingCycle = input.billingCycle ?? existing.billingCycle;
  const billingAmount = input.billingAmount ?? Number(existing.billingAmount);
  const costs = billingEquivalents(billingCycle, billingAmount);
  const costChanged = input.billingAmount !== undefined && input.billingAmount !== Number(existing.billingAmount);
  const renewalChanged = input.renewalDate !== undefined && input.renewalDate !== existing.renewalDate?.toISOString().slice(0, 10);
  return runLicenseTransaction(async (store) => {
    if (input.status === 'CANCELLED' && existing.status !== 'CANCELLED') {
      const activeAssignments = await store.countActiveAssignmentsForSubscription(id);
      if (activeAssignments > 0) throw subscriptionCancelBlockedError();
    }
    if (input.productName || input.vendor !== undefined || input.category !== undefined || input.active !== undefined) {
      await store.updateProduct(existing.productId, {
          name: input.productName,
          vendor: input.vendor,
          category: input.category,
          description: input.description,
          website: input.website,
          active: input.active,
      });
    }
    const subscription = await store.updateSubscription(id, {
        planName: input.planName,
        totalSeats: input.totalSeats,
        billingCycle,
        currency: input.currency,
        billingAmount: money(billingAmount),
        monthlyCost: money(costs.monthlyCost),
        annualCost: money(costs.annualCost),
        startDate: input.startDate ? dateOnly(input.startDate) : undefined,
        renewalDate: input.renewalDate === undefined ? undefined : input.renewalDate ? dateOnly(input.renewalDate) : null,
        paymentDay: input.paymentDay,
        autoRenew: input.autoRenew,
        status: input.status,
        notes: input.notes,
        expiringSoonDays: input.expiringSoonDays,
        updatedById: userId,
    });
    await store.audit({
      organizationId, userId, action: 'SUBSCRIPTION_EDITED', entityId: id, entityType: 'SoftwareSubscription',
      title: 'Suscripción editada', description: subscription.product.name, previousData: { status: existing.status, billingAmount: Number(existing.billingAmount) }, newData: input,
    });
    if (costChanged) {
      await store.audit({
        organizationId, userId, action: 'COST_CHANGED', entityId: id, entityType: 'SoftwareSubscription',
        title: 'Costo actualizado', description: subscription.product.name, previousData: { billingAmount: Number(existing.billingAmount) }, newData: { billingAmount },
      });
    }
    if (renewalChanged) {
      await store.audit({
        organizationId, userId, action: 'RENEWAL_DATE_CHANGED', entityId: id, entityType: 'SoftwareSubscription',
        title: 'Fecha de renovación actualizada', description: subscription.product.name, newData: { renewalDate: input.renewalDate },
      });
    }
    if (input.status === 'ACTIVE' && existing.status !== 'ACTIVE' && input.renewalDate) {
      await store.audit({
        organizationId, userId, action: 'SUBSCRIPTION_RENEWED', entityId: id, entityType: 'SoftwareSubscription',
        title: 'Suscripción renovada', description: subscription.product.name, newData: { renewalDate: input.renewalDate },
      });
    }
    return subscription;
  });
}

function licenseNotFound(code: string, message: string) {
  return new LicenseDomainError(code, message, 404);
}

async function loadSeat(seatId: string, organizationId: string) {
  const seat = await findSeatWithAssignments(seatId, organizationId);
  if (!seat) throw licenseNotFound('SEAT_NOT_FOUND', 'El asiento no existe en esta organización.');
  return seat;
}

function occupancy(seat: {
  seatType: SeatOccupancy['seatType'];
  status: SeatOccupancy['status'];
  assignments: unknown[];
  equipmentId?: string | null;
}): SeatOccupancy {
  return {
    seatType: seat.seatType,
    status: seat.status,
    activeAssignments: seat.assignments.length,
    equipmentId: seat.equipmentId ?? null,
  };
}

function presentSeat<T extends Record<string, unknown> & { licenseKey?: string | null }>(seat: T) {
  const key = seat.licenseKey ?? null;
  return {
    ...seat,
    licenseKey: maskLicenseKey(key),
    licenseKeyPresent: Boolean(key),
  } as T & { licenseKey: string | null; licenseKeyPresent: boolean };
}

export async function createSeat(
  subscriptionId: string,
  input: {
    accountEmail?: string | null;
    accountIdentifier?: string | null;
    seatType?: SeatOccupancy['seatType'];
    equipmentId?: string | null;
    licenseKey?: string | null;
    notes?: string | null;
    employeeId?: string | null;
  },
  organizationId: string,
  userId: string,
) {
  const subscription = await findSubscriptionWithSeatsAndProduct(subscriptionId, organizationId);
  if (!subscription) throw new Error('SUBSCRIPTION_NOT_FOUND');
  const seatType = input.seatType ?? 'INDIVIDUAL';
  try {
    assertSeatFields({
      seatType,
      accountEmail: input.accountEmail,
      equipmentId: input.equipmentId,
    });
  } catch {
    throw new LicenseDomainError('SEAT_FIELDS_INVALID', 'Complete los campos requeridos para el tipo de licencia.', 400);
  }
  if (input.equipmentId) {
    const equipment = await findOrganizationEquipment(input.equipmentId, organizationId);
    if (!equipment) throw licenseNotFound('EQUIPMENT_NOT_FOUND', 'El equipo no existe en esta organización.');
  }
  return runLicenseTransaction(async (store) => {
    const seat = await store.createSeat({
      subscriptionId,
      accountEmail: input.accountEmail || null,
      accountIdentifier: input.accountIdentifier || null,
      equipmentId: input.equipmentId || null,
      licenseKey: input.licenseKey?.trim() || null,
      seatType,
      notes: input.notes || null,
    });
    await store.audit({
      organizationId,
      userId,
      action: 'SEAT_CREATED',
      entityId: seat.id,
      entityType: 'SoftwareLicenseSeat',
      title: 'Licencia registrada',
      description: `${subscription.product.name} · ${seat.accountEmail ?? seatType}`,
    });
    return presentSeat(seat);
  }).then(async (seat) => {
    if (input.employeeId && seatType === 'INDIVIDUAL') {
      await assignSeat(seat.id, input.employeeId, organizationId, userId, input.notes);
    }
    return seat;
  });
}

export async function updateSeat(
  seatId: string,
  input: {
    accountEmail?: string | null;
    accountIdentifier?: string | null;
    seatType?: SeatOccupancy['seatType'];
    equipmentId?: string | null;
    licenseKey?: string | null;
    status?: SeatOccupancy['status'];
    notes?: string | null;
  },
  organizationId: string,
  userId: string,
) {
  const seat = await loadSeat(seatId, organizationId);
  const current = occupancy(seat);
  if (
    (input.status === 'SUSPENDED' || input.status === 'CANCELLED')
    && seat.assignments.length > 0
  ) {
    throw seatBlockedWithAssignmentsError();
  }
  if (input.seatType && input.seatType !== seat.seatType) {
    const change = canChangeSeatTypeTo(input.seatType, current);
    if (!change.ok) {
      throw new LicenseDomainError(change.code, change.message, 409);
    }
    try {
      assertSeatFields({
        seatType: input.seatType,
        accountEmail: input.accountEmail ?? seat.accountEmail,
        equipmentId: input.equipmentId ?? seat.equipmentId,
      });
    } catch {
      throw new LicenseDomainError('SEAT_FIELDS_INVALID', 'Complete los campos requeridos para el tipo de licencia.', 400);
    }
  }
  let status = input.status ?? seat.status;
  if (input.status === 'SUSPENDED' || input.status === 'CANCELLED') status = input.status;
  if (input.status === 'AVAILABLE') status = 'AVAILABLE';
  const action = input.status === 'SUSPENDED'
    ? 'SEAT_SUSPENDED'
    : input.status === 'CANCELLED'
      ? 'SEAT_CANCELLED'
      : input.seatType === 'SHARED' && seat.seatType === 'INDIVIDUAL'
        ? 'SEAT_CONVERTED_SHARED'
        : input.seatType === 'INDIVIDUAL' && seat.seatType === 'SHARED'
          ? 'SEAT_CONVERTED_INDIVIDUAL'
          : input.status === 'AVAILABLE' || input.status === 'ASSIGNED'
            ? 'SEAT_REACTIVATED'
            : 'SEAT_UPDATED';
  return runLicenseTransaction(async (store) => {
    const updated = await store.updateSeat(seatId, {
      accountEmail: input.accountEmail === undefined ? undefined : input.accountEmail || null,
      accountIdentifier: input.accountIdentifier,
      seatType: input.seatType,
      equipmentId: input.equipmentId === undefined ? undefined : input.equipmentId || null,
      licenseKey: input.licenseKey === undefined ? undefined : input.licenseKey?.trim() || null,
      status,
      notes: input.notes,
    });
    await store.audit({
      organizationId, userId, action, entityId: seatId, entityType: 'SoftwareLicenseSeat',
      title: 'Licencia actualizada', description: seat.subscription.product.name, previousData: { status: seat.status, seatType: seat.seatType }, newData: input,
    });
    return presentSeat(updated);
  });
}

export async function assignSeat(seatId: string, employeeId: string, organizationId: string, userId: string, notes?: string | null, replaceAssignmentId?: string) {
  const employee = await findOrganizationEmployee(employeeId, organizationId);
  if (!employee) throw licenseNotFound('EMPLOYEE_NOT_FOUND', 'El empleado no existe en esta organización.');
  if (!employee.isActive) {
    throw new LicenseDomainError('EMPLOYEE_INACTIVE', 'Solo se pueden asignar empleados activos.', 409);
  }

  return runLicenseTransaction(async (store) => {
    const locked = await store.lockSeatForUpdate(seatId, organizationId);
    if (!locked) throw licenseNotFound('SEAT_NOT_FOUND', 'El asiento no existe en esta organización.');

    const seat = await store.findSeatWithAssignmentsInTx(seatId, organizationId);
    if (!seat) throw licenseNotFound('SEAT_NOT_FOUND', 'El asiento no existe en esta organización.');

    assertSameOrganization(employee.organizationId, seat.subscription.organizationId);

    if (seat.subscription.status !== 'ACTIVE') {
      throw subscriptionNotAssignableError('SUSPENDED');
    }
    const displayStatus = displaySubscriptionStatus(
      seat.subscription.status,
      seat.subscription.renewalDate,
      new Date(),
      seat.subscription.expiringSoonDays,
    );
    if (displayStatus === 'EXPIRED') {
      throw subscriptionNotAssignableError('EXPIRED');
    }

    const current = occupancy(seat);
    if (replaceAssignmentId) {
      const target = seat.assignments.find((assignment) => assignment.id === replaceAssignmentId);
      if (!target) {
        throw licenseNotFound('ASSIGNMENT_NOT_FOUND', 'La asignación no existe o ya fue cerrada.');
      }
    } else if (seat.seatType === 'INDIVIDUAL' && current.activeAssignments > 0) {
      throw new LicenseDomainError(
        'LICENSE_ALREADY_ASSIGNED',
        'Esta cuenta personal ya tiene un usuario activo. Use Reasignar para cambiarlo.',
        409,
      );
    } else if (!canAssignSeat(current)) {
      throw new LicenseDomainError('SEAT_NOT_ASSIGNABLE', 'La licencia no admite otra asignación.', 409);
    }
    if (seat.assignments.some((assignment) => assignment.employeeId === employeeId)) {
      throw new LicenseDomainError(
        'EMPLOYEE_ALREADY_ASSIGNED',
        'Ese empleado ya tiene una asignación activa en el asiento.',
        409,
      );
    }

    if (replaceAssignmentId) {
      await store.closeAssignment(replaceAssignmentId, userId);
      await store.audit({
        organizationId, userId, action: 'SEAT_UNASSIGNED', entityId: replaceAssignmentId, entityType: 'LicenseAssignment',
        title: 'Asignación reemplazada', description: seat.subscription.product.name,
      });
    }
    const assignment = await store.createAssignment({ seatId, employeeId, assignedById: userId, notes: notes || null });
    await store.audit({
      organizationId, userId,
      action: seat.seatType === 'SHARED' ? 'SHARED_ASSIGNMENT_ADDED' : 'SEAT_ASSIGNED',
      entityId: assignment.id, entityType: 'LicenseAssignment',
      title: 'Asiento asignado', description: `${seat.subscription.product.name} · ${employee.fullName}`,
      newData: { employeeId, seatId },
    });
    return assignment;
  });
}

export async function unassignSeat(assignmentId: string, organizationId: string, userId: string) {
  const assignment = await findOpenAssignment(assignmentId, organizationId);
  if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND');
  return runLicenseTransaction(async (store) => {
    const updated = await store.closeAssignment(assignmentId, userId);
    await store.audit({
      organizationId, userId,
      action: assignment.seat.seatType === 'SHARED' ? 'SHARED_ASSIGNMENT_REMOVED' : 'SEAT_UNASSIGNED',
      entityId: assignmentId, entityType: 'LicenseAssignment',
      title: 'Asignación cerrada', description: `${assignment.seat.subscription.product.name} · ${assignment.employee.fullName}`,
    });
    return updated;
  });
}

export async function getSoftwareSubscription(id: string, organizationId: string, today = new Date()) {
  const subscription = await findSubscriptionDetail(id, organizationId);
  if (!subscription) return null;
  return presentSubscription(subscription, today);
}

function presentSubscription<T extends {
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  renewalDate: Date | null;
  expiringSoonDays: number;
  monthlyCost: Prisma.Decimal;
  annualCost: Prisma.Decimal;
  billingAmount: Prisma.Decimal;
  seats: Array<{ status: SeatOccupancy['status']; seatType: SeatOccupancy['seatType']; assignments: Array<{ unassignedAt: Date | null }> }>;
  totalSeats: number;
}>(subscription: T, today: Date) {
  const seats = subscription.seats.map((seat) => {
    const activeAssignments = seat.assignments.filter((assignment) => assignment.unassignedAt === null).length;
    const occupancyState = {
      status: seat.status,
      seatType: seat.seatType,
      activeAssignments,
      equipmentId: 'equipmentId' in seat ? (seat as { equipmentId?: string | null }).equipmentId : null,
    };
    return presentSeat({
      ...seat,
      activeAssignments,
      effectiveStatus: effectiveSeatStatus(occupancyState),
    });
  });
  const counts = summarizeSeats(
    subscription.seats.map((seat) => {
      const activeAssignments = seat.assignments.filter((assignment) => assignment.unassignedAt === null).length;
      return {
        status: seat.status,
        seatType: seat.seatType,
        activeAssignments,
        equipmentId: 'equipmentId' in seat ? (seat as { equipmentId?: string | null }).equipmentId ?? null : null,
      };
    }),
    subscription.totalSeats,
  );
  const monthly = Number(subscription.monthlyCost);
  return {
    ...subscription,
    billingAmount: Number(subscription.billingAmount),
    monthlyCost: monthly,
    annualCost: Number(subscription.annualCost),
    unitMonthlyCost: unitMonthlyCost(monthly, subscription.totalSeats),
    wastedMonthlyCost: unitMonthlyCost(monthly, subscription.totalSeats) * counts.freeSeats,
    displayStatus: displaySubscriptionStatus(subscription.status, subscription.renewalDate, today, subscription.expiringSoonDays),
    renewalAlert: renewalAlert(subscription.renewalDate, today, subscription.status),
    counts,
    seats,
  };
}

export async function listSoftwareSubscriptions(organizationId: string, filters: {
  search?: string;
  status?: string;
  seatType?: SeatOccupancy['seatType'];
  vendor?: string;
  renewal?: 'IN_7_DAYS' | 'IN_15_DAYS' | 'IN_30_DAYS' | 'EXPIRED';
}, today = new Date()) {
  const subscriptions = await listSubscriptions(organizationId, { search: filters.search, vendor: filters.vendor });
  return subscriptions
    .map((subscription) => presentSubscription(subscription, today))
    .filter((subscription) => !filters.status || subscription.displayStatus === filters.status)
    .filter((subscription) => !filters.renewal || subscription.renewalAlert === filters.renewal)
    .filter((subscription) => !filters.seatType || subscription.seats.some((seat) => seat.seatType === filters.seatType));
}

export async function licenseDashboard(organizationId: string, today = new Date()) {
  const subscriptions = await listSoftwareSubscriptions(organizationId, {}, today);
  const activeProducts = new Set(subscriptions.filter((item) => item.product.active && item.status !== 'CANCELLED').map((item) => item.productId));
  const totals = subscriptions.reduce((sum, item) => {
    if (item.status === 'CANCELLED') return sum;
    sum.contractedSeats += item.counts.contractedSeats;
    sum.registeredSeats += item.counts.registeredSeats;
    sum.inUseSeats += item.counts.inUseSeats;
    sum.freeSeats += item.counts.freeSeats;
    sum.wastedMonthlyCost += item.wastedMonthlyCost;
    sum.occupiedSeats += item.counts.occupiedSeats;
    sum.availableSeats += item.counts.availableSeats;
    sum.assignedUsers += item.counts.assignedUsers;
    sum.sharedAccounts += item.counts.sharedAccounts;
    const bucket = sum.costs[item.currency] ?? { monthlyCost: 0, annualCost: 0, wastedMonthlyCost: 0 };
    bucket.monthlyCost += item.monthlyCost;
    bucket.annualCost += item.annualCost;
    bucket.wastedMonthlyCost += item.wastedMonthlyCost;
    sum.costs[item.currency] = bucket;
    if (item.renewalAlert === 'IN_30_DAYS' || item.renewalAlert === 'IN_15_DAYS' || item.renewalAlert === 'IN_7_DAYS') {
      sum.expiringIn30Days += 1;
    }
    return sum;
  }, {
    contractedSeats: 0,
    registeredSeats: 0,
    inUseSeats: 0,
    freeSeats: 0,
    wastedMonthlyCost: 0,
    occupiedSeats: 0,
    availableSeats: 0,
    assignedUsers: 0,
    sharedAccounts: 0,
    expiringIn30Days: 0,
    costs: {} as Record<string, { monthlyCost: number; annualCost: number; wastedMonthlyCost: number }>,
  });
  return {
    activeProducts: activeProducts.size,
    ...totals,
    upcomingRenewals: subscriptions.filter((item) => item.renewalAlert && item.renewalAlert !== 'EXPIRED').length,
    expiredOrSuspended: subscriptions.filter((item) => item.displayStatus === 'EXPIRED' || item.displayStatus === 'SUSPENDED').length,
    byProduct: subscriptions.filter((item) => item.status !== 'CANCELLED').map((item) => ({
      productId: item.productId,
      name: item.product.name,
      currency: item.currency,
      monthlyCost: item.monthlyCost,
      annualCost: item.annualCost,
      contractedSeats: item.counts.contractedSeats,
      inUseSeats: item.counts.inUseSeats,
      freeSeats: item.counts.freeSeats,
    })),
  };
}

export async function registerSubscriptionRenewal(
  subscriptionId: string,
  input: { billingAmount?: number; renewalDate?: string | null },
  organizationId: string,
  userId: string,
  today = new Date(),
) {
  const existing = await findSubscriptionWithProduct(subscriptionId, organizationId);
  if (!existing) throw new Error('SUBSCRIPTION_NOT_FOUND');
  const nextRenewal = advanceRenewalDate(
    existing.renewalDate,
    existing.billingCycle,
    today,
    input.renewalDate,
  );
  const billingAmount = input.billingAmount ?? Number(existing.billingAmount);
  const costs = billingEquivalents(existing.billingCycle, billingAmount);
  await runLicenseTransaction(async (store) => {
    const updated = await store.updateSubscription(subscriptionId, {
      renewalDate: nextRenewal,
      billingAmount: money(billingAmount),
      monthlyCost: money(costs.monthlyCost),
      annualCost: money(costs.annualCost),
      updatedById: userId,
    });
    await store.audit({
      organizationId,
      userId,
      action: 'SUBSCRIPTION_RENEWED',
      entityId: subscriptionId,
      entityType: 'SoftwareSubscription',
      title: 'Renovación registrada',
      description: updated.product.name,
      previousData: {
        renewalDate: existing.renewalDate?.toISOString().slice(0, 10) ?? null,
        billingAmount: Number(existing.billingAmount),
      },
      newData: {
        renewalDate: nextRenewal.toISOString().slice(0, 10),
        billingAmount,
      },
    });
  });
  return getSoftwareSubscription(subscriptionId, organizationId, today);
}

export async function revealSeatLicenseKey(seatId: string, organizationId: string, userId: string) {
  const seat = await findSeatWithAssignments(seatId, organizationId);
  if (!seat) throw licenseNotFound('SEAT_NOT_FOUND', 'La licencia no existe en esta organización.');
  if (!seat.licenseKey) throw new LicenseDomainError('LICENSE_KEY_EMPTY', 'Esta licencia no tiene clave guardada.', 404);
  await runLicenseTransaction(async (store) => {
    await store.audit({
      organizationId,
      userId,
      action: 'LICENSE_KEY_REVEALED',
      entityId: seatId,
      entityType: 'SoftwareLicenseSeat',
      title: 'Clave de licencia visualizada',
      description: seat.subscription.product.name,
    });
  });
  return { licenseKey: seat.licenseKey };
}

export async function getEquipmentDeviceLicenses(equipmentId: string, organizationId: string) {
  const rows = await listDeviceLicensesForEquipment(equipmentId, organizationId);
  return rows.map((seat) => {
    const activeAssignments = seat.assignments.length;
    const occupancyState = {
      status: seat.status,
      seatType: seat.seatType,
      activeAssignments,
      equipmentId: seat.equipmentId,
    };
    return presentSeat({
      ...seat,
      activeAssignments,
      effectiveStatus: effectiveSeatStatus(occupancyState),
    });
  });
}

export { countActiveDeviceLicensesForEquipment } from '@/modules/software-licenses/infrastructure/release-device-licenses';

export async function syncRenewalNotifications(organizationId: string, today = new Date()) {
  const subscriptions = await listSoftwareSubscriptions(organizationId, {}, today);
  for (const subscription of subscriptions) {
    if (!subscription.renewalAlert || !subscription.renewalDate) continue;
    const idempotencyKey = `license-renewal:${subscription.id}:${subscription.renewalAlert}:${subscription.renewalDate.toISOString().slice(0, 10)}`;
    await upsertRenewalNotification(organizationId, idempotencyKey, {
        eventType: `software-license.${subscription.renewalAlert.toLowerCase()}`,
        channel: 'IN_APP',
        status: 'SENT',
        title: subscription.renewalAlert === 'EXPIRED' ? 'Suscripción vencida' : 'Renovación próxima',
        body: `${subscription.product.name} · ${subscription.planName}`,
        actionUrl: `/activos/licencias/${subscription.id}`,
        sentAt: today,
    });
  }
}

export async function importLicenseRows(rows: LicenseImportRow[], organizationId: string, userId: string) {
  const plan = planLicenseImport(rows);
  const employees = await listEmployeeNames(organizationId);
  const byName = new Map(employees.map((employee) => [employee.fullName.trim().toLowerCase(), employee]));
  const equipmentRows = await listOrganizationEquipmentCodes(organizationId);
  const byInventory = new Map(equipmentRows.map((item) => [item.inventoryCode.trim().toLowerCase(), item]));
  const report = {
    products: 0,
    subscriptions: 0,
    seats: 0,
    assignments: 0,
    unmatchedEmployees: [] as Array<{ rowNumber: number; name: string; software: string }>,
    duplicates: plan.warnings.filter((warning) => warning.code === 'DUPLICATE_ASSIGNMENT'),
    warnings: plan.warnings,
  };
  await runLicenseTransaction(async (store) => {
    for (const productPlan of plan.products) {
      const product = await store.upsertProduct({
        where: { organizationId_name: { organizationId, name: productPlan.software } },
        update: { active: true },
        create: { organizationId, name: productPlan.software },
      });
      report.products += 1;
      const costs = billingEquivalents(productPlan.billingCycle, 0);
      const subscription = await store.createSubscription({
          organizationId,
          productId: product.id,
          planName: 'Importado',
          totalSeats: productPlan.seats.length,
          billingCycle: productPlan.billingCycle,
          currency: 'USD',
          billingAmount: money(0),
          monthlyCost: money(costs.monthlyCost),
          annualCost: money(costs.annualCost),
          startDate: new Date(),
          paymentDay: productPlan.paymentDay,
          renewalDate: productPlan.renewalDate ? dateOnly(productPlan.renewalDate) : null,
          createdById: userId,
      });
      report.subscriptions += 1;
      for (const seatPlan of productPlan.seats) {
        let equipmentId: string | null = seatPlan.equipmentId ?? null;
        if (seatPlan.seatType === 'DEVICE' && seatPlan.equipmentInventoryCode) {
          const equipment = byInventory.get(seatPlan.equipmentInventoryCode.trim().toLowerCase());
          if (!equipment) {
            report.warnings.push({
              rowNumber: 0,
              code: 'UNMATCHED_EMPLOYEE',
              message: `Equipo ${seatPlan.equipmentInventoryCode} no encontrado para ${productPlan.software}.`,
            });
            continue;
          }
          equipmentId = equipment.id;
        }
        const seat = await store.createSeat({
          subscriptionId: subscription.id,
          accountEmail: seatPlan.accountEmail,
          equipmentId,
          seatType: seatPlan.seatType,
          status:
            seatPlan.status === 'SUSPENDED' || seatPlan.status === 'CANCELLED'
              ? seatPlan.status
              : 'AVAILABLE',
        });
        report.seats += 1;
        for (const assignment of seatPlan.assignments) {
          const employee = byName.get(assignment.employeeName.trim().toLowerCase());
          if (!employee) {
            report.unmatchedEmployees.push({ rowNumber: assignment.rowNumber, name: assignment.employeeName, software: productPlan.software });
            report.warnings.push({ rowNumber: assignment.rowNumber, code: 'UNMATCHED_EMPLOYEE', message: `${assignment.employeeName} no está en el catálogo de empleados.` });
            continue;
          }
          await store.createAssignment({ seatId: seat.id, employeeId: employee.id, assignedById: userId });
          report.assignments += 1;
        }
      }
      await store.audit({
        organizationId, userId, action: 'SUBSCRIPTION_IMPORTED', entityId: subscription.id, entityType: 'SoftwareSubscription',
        title: 'Suscripción importada', description: productPlan.software,
      });
    }
  });
  return report;
}
