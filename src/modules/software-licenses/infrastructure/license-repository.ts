import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createAuditRecord } from '@/platform/security/audit/audit-record';

type Db = PrismaClient | Prisma.TransactionClient;

export type LicenseAuditInput = {
  organizationId: string;
  userId: string;
  action: string;
  title: string;
  description: string;
  entityId: string;
  entityType: string;
  previousData?: unknown;
  newData?: unknown;
};

const seatInclude = {
  equipment: {
    select: {
      id: true,
      inventoryCode: true,
      brand: true,
      model: true,
      assignments: {
        where: { status: 'ACTIVE' as const },
        take: 1,
        orderBy: { assignedDate: 'desc' as const },
        select: { employee: { select: { id: true, fullName: true } } },
      },
    },
  },
  assignments: {
    include: { employee: { select: { id: true, fullName: true, email: true, isActive: true } } },
    orderBy: { assignedAt: 'asc' as const },
  },
};

export function createLicenseStore(db: Db, tx?: Prisma.TransactionClient) {
  return licenseStore(db, tx);
}

function licenseStore(db: Db, tx?: Prisma.TransactionClient) {
  return {
    upsertProduct(args: Prisma.SoftwareProductUpsertArgs) {
      return db.softwareProduct.upsert(args);
    },
    updateProduct(id: string, data: Prisma.SoftwareProductUpdateInput) {
      return db.softwareProduct.update({ where: { id }, data });
    },
    createSubscriptionWithSeats(data: Prisma.SoftwareSubscriptionUncheckedCreateInput) {
      return db.softwareSubscription.create({ data, include: { product: true, seats: true } });
    },
    createSubscription(data: Prisma.SoftwareSubscriptionUncheckedCreateInput) {
      return db.softwareSubscription.create({ data });
    },
    updateSubscription(id: string, data: Prisma.SoftwareSubscriptionUncheckedUpdateInput) {
      return db.softwareSubscription.update({ where: { id }, data, include: { product: true } });
    },
    listSeatsWithActiveAssignments(subscriptionId: string) {
      return db.softwareLicenseSeat.findMany({
        where: { subscriptionId },
        include: { assignments: { where: { unassignedAt: null } } },
      });
    },
    createSeats(data: Prisma.SoftwareLicenseSeatCreateManyInput[]) {
      return db.softwareLicenseSeat.createMany({ data });
    },
    createSeat(data: Prisma.SoftwareLicenseSeatUncheckedCreateInput) {
      return db.softwareLicenseSeat.create({ data });
    },
    updateSeat(id: string, data: Prisma.SoftwareLicenseSeatUncheckedUpdateInput) {
      return db.softwareLicenseSeat.update({ where: { id }, data });
    },
    closeAssignment(id: string, userId: string) {
      return db.licenseAssignment.update({
        where: { id },
        data: { unassignedAt: new Date(), unassignedById: userId },
      });
    },
    createAssignment(data: Prisma.LicenseAssignmentUncheckedCreateInput) {
      return db.licenseAssignment.create({ data });
    },
    async lockSeatForUpdate(seatId: string, organizationId: string) {
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM software_license_seats s
        INNER JOIN software_subscriptions sub ON sub.id = s."subscriptionId"
        WHERE s.id = ${seatId} AND sub."organizationId" = ${organizationId}
        FOR UPDATE
      `;
      if (rows.length === 0) return null;
      return rows[0]!.id;
    },
    findSeatWithAssignmentsInTx(seatId: string, organizationId: string) {
      return db.softwareLicenseSeat.findFirst({
        where: { id: seatId, subscription: { organizationId } },
        include: {
          subscription: { include: { product: true } },
          assignments: {
            where: { unassignedAt: null },
            include: {
              employee: {
                select: { id: true, fullName: true, organizationId: true, isActive: true },
              },
            },
          },
        },
      });
    },
    countActiveAssignmentsForSubscription(subscriptionId: string) {
      return db.licenseAssignment.count({
        where: { unassignedAt: null, seat: { subscriptionId } },
      });
    },
    async audit(input: LicenseAuditInput) {
      await createAuditRecord({
        tx,
        organizationId: input.organizationId,
        userId: input.userId,
        module: 'LICENCIAS',
        category: input.action,
        action: input.action,
        title: input.title,
        description: input.description,
        entityId: input.entityId,
        entityType: input.entityType,
        previousData: input.previousData,
        newData: input.newData,
      });
    },
  };
}

export type LicenseStore = ReturnType<typeof licenseStore>;

export function runLicenseTransaction<T>(work: (store: LicenseStore) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => work(licenseStore(tx, tx)));
}

export function findSubscriptionWithProduct(id: string, organizationId: string) {
  return prisma.softwareSubscription.findFirst({
    where: { id, organizationId },
    include: { product: true },
  });
}

export function findSubscriptionWithSeatsAndProduct(id: string, organizationId: string) {
  return prisma.softwareSubscription.findFirst({ where: { id, organizationId }, include: { seats: true, product: true } });
}

export function findSeatWithAssignments(seatId: string, organizationId: string) {
  return prisma.softwareLicenseSeat.findFirst({
    where: { id: seatId, subscription: { organizationId } },
    include: {
      subscription: { include: { product: true } },
      assignments: { where: { unassignedAt: null }, include: { employee: { select: { id: true, fullName: true, organizationId: true, isActive: true } } } },
    },
  });
}

export function findOrganizationEmployee(employeeId: string, organizationId: string) {
  return prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
}

export function findOrganizationEquipment(equipmentId: string, organizationId: string) {
  return prisma.equipment.findFirst({ where: { id: equipmentId, organizationId } });
}

export function listDeviceLicensesForEquipment(equipmentId: string, organizationId: string) {
  return prisma.softwareLicenseSeat.findMany({
    where: {
      equipmentId,
      seatType: 'DEVICE',
      status: { not: 'CANCELLED' },
      subscription: { organizationId },
    },
    include: {
      subscription: { include: { product: true } },
      assignments: { where: { unassignedAt: null }, include: { employee: { select: { id: true, fullName: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export function findOpenAssignment(assignmentId: string, organizationId: string) {
  return prisma.licenseAssignment.findFirst({
    where: { id: assignmentId, unassignedAt: null, seat: { subscription: { organizationId } } },
    include: { employee: true, seat: { include: { subscription: { include: { product: true } }, assignments: { where: { unassignedAt: null } } } } },
  });
}

export function findSubscriptionDetail(id: string, organizationId: string) {
  return prisma.softwareSubscription.findFirst({
    where: { id, organizationId },
    include: { product: true, seats: { include: seatInclude, orderBy: { createdAt: 'asc' } } },
  });
}

export function listSubscriptions(organizationId: string, filters: { search?: string; vendor?: string }) {
  return prisma.softwareSubscription.findMany({
    where: {
      organizationId,
      ...(filters.vendor ? { product: { vendor: { contains: filters.vendor, mode: 'insensitive' } } } : {}),
      ...(filters.search ? {
        OR: [
          { planName: { contains: filters.search, mode: 'insensitive' } },
          { product: { name: { contains: filters.search, mode: 'insensitive' } } },
          { seats: { some: { accountEmail: { contains: filters.search, mode: 'insensitive' } } } },
          { seats: { some: { assignments: { some: { employee: { fullName: { contains: filters.search, mode: 'insensitive' } } } } } } },
        ],
      } : {}),
    },
    include: { product: true, seats: { include: seatInclude } },
    orderBy: { product: { name: 'asc' } },
  });
}

export function upsertRenewalNotification(organizationId: string, idempotencyKey: string, create: Omit<Prisma.NotificationUncheckedCreateInput, 'organizationId' | 'idempotencyKey'>) {
  return prisma.notification.upsert({
    where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
    update: {},
    create: { organizationId, ...create, idempotencyKey },
  });
}

export function listEmployeeNames(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId },
    select: { id: true, fullName: true, isActive: true },
  });
}

export function listOrganizationEquipmentCodes(organizationId: string) {
  return prisma.equipment.findMany({
    where: { organizationId },
    select: { id: true, inventoryCode: true },
  });
}
