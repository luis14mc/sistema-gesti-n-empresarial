import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { oficioTenantScope } from '@/modules/oficios/infrastructure/tenant-scope';
import { employeeBelongsToOrganization } from '@/platform/import/organization-fk';

export async function findActiveEmployeesByRefs(organizationId: string, lookupRefs: string[], idRefs: string[]) {
  return prisma.employee.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        ...(lookupRefs.length > 0
          ? [
              { email: { in: lookupRefs, mode: 'insensitive' as const } },
              { employeeCode: { in: lookupRefs, mode: 'insensitive' as const } },
            ]
          : []),
        ...(idRefs.length > 0 ? [{ id: { in: idRefs } }] : []),
      ],
    },
    select: { id: true, email: true, employeeCode: true },
  });
}

export async function findLiveOficiosByNumbers(organizationId: string, numbers: string[]) {
  return prisma.oficio.findMany({
    where: {
      ...oficioTenantScope(organizationId),
      archivedAt: null,
      number: { in: numbers, mode: 'insensitive' },
    },
    select: { id: true, number: true, type: true, sequenceYear: true, oficioDate: true },
  });
}

export async function loadNumberingConfigs(organizationId: string) {
  return prisma.oficioNumberingConfig.findMany({
    where: { organizationId, isActive: true },
  });
}

export type ImportNumberingConfig = Awaited<ReturnType<typeof loadNumberingConfigs>>[number];

export async function createImportBatch(data: Prisma.OficioImportBatchUncheckedCreateInput) {
  return prisma.oficioImportBatch.create({ data });
}

export async function createImportBatchItem(data: Prisma.OficioImportBatchItemUncheckedCreateInput) {
  return prisma.oficioImportBatchItem.create({ data });
}

export async function finishImportBatch(id: string, data: Prisma.OficioImportBatchUncheckedUpdateInput) {
  await prisma.oficioImportBatch.update({ where: { id }, data });
}

export async function createNumberingConfig(data: Prisma.OficioNumberingConfigUncheckedCreateInput) {
  return prisma.oficioNumberingConfig.create({ data });
}

export async function updateNumberingConfigSequence(id: string, lastGeneratedSequence: number, updatedById: string) {
  await prisma.oficioNumberingConfig.update({
    where: { id },
    data: { lastGeneratedSequence, updatedById },
  });
}

/** Ejecuta un bloque de filas en una transacción; cada fila corre en su propio SAVEPOINT. */
export async function runImportChunk(
  work: (store: {
    savepoint(name: string): Promise<unknown>;
    releaseSavepoint(name: string): Promise<unknown>;
    rollbackToSavepoint(name: string): Promise<unknown>;
    employeeBelongsToOrganization(employeeId: string, organizationId: string): Promise<boolean>;
    createOficio(data: Prisma.OficioUncheckedCreateInput): Promise<{ id: string }>;
    createBatchItem(data: Prisma.OficioImportBatchItemUncheckedCreateInput): Promise<unknown>;
  }) => Promise<void>,
) {
  await prisma.$transaction(async (tx) => {
    await work({
      savepoint: (name) => tx.$executeRawUnsafe(`SAVEPOINT ${name}`),
      releaseSavepoint: (name) => tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`),
      rollbackToSavepoint: (name) => tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`),
      employeeBelongsToOrganization: (employeeId, organizationId) =>
        employeeBelongsToOrganization(tx, employeeId, organizationId),
      createOficio: (data) => tx.oficio.create({ data }),
      createBatchItem: (data) => tx.oficioImportBatchItem.create({ data }),
    });
  }, { timeout: 120_000 });
}

export async function findUndoableBatch(organizationId: string, batchId: string) {
  return prisma.oficioImportBatch.findFirst({
    where: { id: batchId, organizationId, archivedAt: null },
    include: {
      items: { where: { status: 'IMPORTED', oficioId: { not: null } }, select: { oficioId: true } },
    },
  });
}

export async function findOficioModifiedAfter(oficioIds: string[], finishedAt: Date) {
  return prisma.oficio.findFirst({
    where: {
      id: { in: oficioIds },
      updatedAt: { gt: finishedAt },
    },
    select: { id: true },
  });
}

export async function runUndoImportTransaction(
  work: (store: {
    archiveOficios(oficioIds: string[], organizationId: string, userId: string): Promise<unknown>;
    restoreConfigSequence(configId: string, lastGeneratedSequence: number, userId: string): Promise<unknown>;
    restoreConfigSequenceByKey(
      organizationId: string,
      dependency: string,
      year: number,
      lastGeneratedSequence: number,
      userId: string,
    ): Promise<unknown>;
    archiveBatch(batchId: string): Promise<unknown>;
  }) => Promise<void>,
) {
  await prisma.$transaction(async (tx) => {
    await work({
      archiveOficios: (oficioIds, organizationId, userId) =>
        tx.oficio.updateMany({
          where: { id: { in: oficioIds }, organizationId },
          data: { archivedAt: new Date(), updatedById: userId },
        }),
      restoreConfigSequence: (configId, lastGeneratedSequence, userId) =>
        tx.oficioNumberingConfig.update({
          where: { id: configId },
          data: { lastGeneratedSequence, updatedById: userId },
        }),
      restoreConfigSequenceByKey: (organizationId, dependency, year, lastGeneratedSequence, userId) =>
        tx.oficioNumberingConfig.updateMany({
          where: { organizationId, dependency, year },
          data: { lastGeneratedSequence, updatedById: userId },
        }),
      archiveBatch: (batchId) =>
        tx.oficioImportBatch.update({
          where: { id: batchId },
          data: { archivedAt: new Date(), status: 'FAILED', notes: 'Lote deshecho por el usuario.' },
        }),
    });
  });
}
