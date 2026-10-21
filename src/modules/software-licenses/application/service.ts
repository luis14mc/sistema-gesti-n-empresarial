import { Prisma } from '@prisma/client';
import {
  findOpenAssignment,
  findOrganizationEmployee,
  findSeatWithAssignments,
  findSubscriptionDetail,
  findSubscriptionWithProduct,
  findSubscriptionWithSeatsAndProduct,
  listEmployeeNames,
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
  canAssignSeat,
  canConvertToIndividual,
  effectiveSeatStatus,
  summarizeSeats,
  type SeatOccupancy,
} from '@/modules/software-licenses/domain/seats';

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
        seats: {
          create: Array.from({ length: input.totalSeats }, () => ({ seatType: 'INDIVIDUAL' as const, status: 'AVAILABLE' as const })),
        },
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
    if (input.totalSeats !== undefined && input.totalSeats !== existing.totalSeats) {
      const seatRows = await store.listSeatsWithActiveAssignments(id);
      const activeRows = seatRows.filter((seat) => seat.status !== 'CANCELLED');
      if (input.totalSeats > activeRows.length) {
        const needed = input.totalSeats - activeRows.length;
        await store.createSeats(Array.from({ length: needed }, () => ({
          subscriptionId: id,
          seatType: 'INDIVIDUAL' as const,
          status: 'AVAILABLE' as const,
        })));
      } else if (input.totalSeats < activeRows.length) {
        const toRemove = activeRows.length - input.totalSeats;
        const removable = activeRows
          .filter((seat) => seat.assignments.length === 0 && effectiveSeatStatus({ status: seat.status, seatType: seat.seatType, activeAssignments: 0 }) === 'AVAILABLE')
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (removable.length < toRemove) throw new Error('TOTAL_SEATS_CANNOT_SHRINK');
        for (const seat of removable.slice(0, toRemove)) {
          await store.updateSeat(seat.id, { status: 'CANCELLED' });
        }
      }
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

async function loadSeat(seatId: string, organizationId: string) {
  const seat = await findSeatWithAssignments(seatId, organizationId);
  if (!seat) throw new Error('SEAT_NOT_FOUND');
  return seat;
}

function occupancy(seat: { seatType: SeatOccupancy['seatType']; status: SeatOccupancy['status']; assignments: unknown[] }): SeatOccupancy {
  return { seatType: seat.seatType, status: seat.status, activeAssignments: seat.assignments.length };
}

export async function createSeat(subscriptionId: string, input: { accountEmail?: string | null; accountIdentifier?: string | null; seatType?: 'INDIVIDUAL' | 'SHARED'; notes?: string | null }, organizationId: string, userId: string) {
  const subscription = await findSubscriptionWithSeatsAndProduct(subscriptionId, organizationId);
  if (!subscription) throw new Error('SUBSCRIPTION_NOT_FOUND');
  if (subscription.seats.filter((seat) => seat.status !== 'CANCELLED').length >= subscription.totalSeats) {
    throw new Error('SEAT_LIMIT_REACHED');
  }
  return runLicenseTransaction(async (store) => {
    const seat = await store.createSeat({
        subscriptionId,
        accountEmail: input.accountEmail || null,
        accountIdentifier: input.accountIdentifier || null,
        seatType: input.seatType ?? 'INDIVIDUAL',
        notes: input.notes || null,
    });
    await store.audit({
      organizationId, userId, action: 'SEAT_CREATED', entityId: seat.id, entityType: 'SoftwareLicenseSeat',
      title: 'Asiento creado', description: `${subscription.product.name} · ${seat.accountEmail ?? 'sin cuenta'}`,
    });
    return seat;
  });
}

export async function updateSeat(seatId: string, input: { accountEmail?: string | null; accountIdentifier?: string | null; seatType?: 'INDIVIDUAL' | 'SHARED'; status?: SeatOccupancy['status']; notes?: string | null }, organizationId: string, userId: string) {
  const seat = await loadSeat(seatId, organizationId);
  const current = occupancy(seat);
  if (input.seatType === 'INDIVIDUAL' && !canConvertToIndividual({ ...current, seatType: 'SHARED' }) && current.seatType === 'SHARED') {
    throw new Error('SHARED_SEAT_HAS_MULTIPLE_ASSIGNMENTS');
  }
  let status = input.status ?? effectiveSeatStatus(current);
  if (input.status === 'SUSPENDED' || input.status === 'CANCELLED' || input.status === 'AVAILABLE') status = input.status;
  if (status === 'AVAILABLE' && current.activeAssignments > 0) throw new Error('SEAT_STILL_ASSIGNED');
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
        status,
        notes: input.notes,
    });
    await store.audit({
      organizationId, userId, action, entityId: seatId, entityType: 'SoftwareLicenseSeat',
      title: 'Asiento actualizado', description: seat.subscription.product.name, previousData: { status: seat.status, seatType: seat.seatType }, newData: input,
    });
    return updated;
  });
}

export async function assignSeat(seatId: string, employeeId: string, organizationId: string, userId: string, notes?: string | null, replaceAssignmentId?: string) {
  const seat = await loadSeat(seatId, organizationId);
  const employee = await findOrganizationEmployee(employeeId, organizationId);
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
  assertSameOrganization(employee.organizationId, seat.subscription.organizationId);
  if (!employee.isActive) throw new Error('EMPLOYEE_INACTIVE');
  const current = occupancy(seat);
  if (replaceAssignmentId) {
    const target = seat.assignments.find((assignment) => assignment.id === replaceAssignmentId);
    if (!target) throw new Error('ASSIGNMENT_NOT_FOUND');
  } else if (!canAssignSeat(current)) {
    throw new Error('SEAT_NOT_ASSIGNABLE');
  }
  if (seat.assignments.some((assignment) => assignment.employeeId === employeeId)) throw new Error('EMPLOYEE_ALREADY_ASSIGNED');
  const shared = seat.seatType === 'SHARED' || current.activeAssignments > 0;
  return runLicenseTransaction(async (store) => {
    if (replaceAssignmentId) {
      await store.closeAssignment(replaceAssignmentId, userId);
      await store.audit({
        organizationId, userId, action: 'SEAT_UNASSIGNED', entityId: replaceAssignmentId, entityType: 'LicenseAssignment',
        title: 'Asignación reemplazada', description: seat.subscription.product.name,
      });
    }
    const assignment = await store.createAssignment({ seatId, employeeId, assignedById: userId, notes: notes || null });
    await store.updateSeat(seatId, { status: 'ASSIGNED', seatType: shared && !replaceAssignmentId && current.activeAssignments > 0 ? 'SHARED' : seat.seatType });
    await store.audit({
      organizationId, userId,
      action: seat.seatType === 'SHARED' || shared ? 'SHARED_ASSIGNMENT_ADDED' : 'SEAT_ASSIGNED',
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
  const remaining = assignment.seat.assignments.filter((item) => item.id !== assignmentId).length;
  return runLicenseTransaction(async (store) => {
    const updated = await store.closeAssignment(assignmentId, userId);
    if (assignment.seat.status !== 'SUSPENDED' && assignment.seat.status !== 'CANCELLED') {
      await store.updateSeat(assignment.seatId, { status: remaining > 0 ? 'ASSIGNED' : 'AVAILABLE' });
    }
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
    const occupancyState = { status: seat.status, seatType: seat.seatType, activeAssignments };
    return { ...seat, activeAssignments, effectiveStatus: effectiveSeatStatus(occupancyState) };
  });
  return {
    ...subscription,
    billingAmount: Number(subscription.billingAmount),
    monthlyCost: Number(subscription.monthlyCost),
    annualCost: Number(subscription.annualCost),
    displayStatus: displaySubscriptionStatus(subscription.status, subscription.renewalDate, today, subscription.expiringSoonDays),
    renewalAlert: renewalAlert(subscription.renewalDate, today, subscription.status),
    counts: summarizeSeats(seats.map((seat) => ({ status: seat.status, seatType: seat.seatType, activeAssignments: seat.activeAssignments })), subscription.totalSeats),
    seats,
  };
}

export async function listSoftwareSubscriptions(organizationId: string, filters: {
  search?: string;
  status?: string;
  seatType?: 'INDIVIDUAL' | 'SHARED';
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
    sum.occupiedSeats += item.counts.occupiedSeats;
    sum.availableSeats += item.counts.availableSeats;
    sum.assignedUsers += item.counts.assignedUsers;
    sum.sharedAccounts += item.counts.sharedAccounts;
    const bucket = sum.costs[item.currency] ?? { monthlyCost: 0, annualCost: 0 };
    bucket.monthlyCost += item.monthlyCost;
    bucket.annualCost += item.annualCost;
    sum.costs[item.currency] = bucket;
    return sum;
  }, {
    contractedSeats: 0,
    occupiedSeats: 0,
    availableSeats: 0,
    assignedUsers: 0,
    sharedAccounts: 0,
    costs: {} as Record<string, { monthlyCost: number; annualCost: number }>,
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
      occupiedSeats: item.counts.occupiedSeats,
    })),
  };
}

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
        actionUrl: `/ti/licencias/${subscription.id}`,
        sentAt: today,
    });
  }
}

export async function importLicenseRows(rows: LicenseImportRow[], organizationId: string, userId: string) {
  const plan = planLicenseImport(rows);
  const employees = await listEmployeeNames(organizationId);
  const byName = new Map(employees.map((employee) => [employee.fullName.trim().toLowerCase(), employee]));
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
        const seat = await store.createSeat({
            subscriptionId: subscription.id,
            accountEmail: seatPlan.accountEmail,
            seatType: seatPlan.assignments.length > 1 ? 'SHARED' : seatPlan.seatType,
            status: seatPlan.assignments.length > 0 && seatPlan.status !== 'SUSPENDED' && seatPlan.status !== 'CANCELLED' ? 'ASSIGNED' : seatPlan.status,
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
