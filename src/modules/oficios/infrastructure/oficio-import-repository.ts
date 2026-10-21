import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  oficioBatchScope,
  oficioBatchTenantScope,
  oficioDocumentTenantScope,
  oficioTenantScope,
} from '@/modules/oficios/infrastructure/tenant-scope';

export interface DuplicateMatch {
  id: string;
  number: string;
  reason: string;
  field: 'number' | 'institution+date' | 'fileHash' | 'originalName';
}

export interface DuplicateResult {
  hard: DuplicateMatch[];
  soft: DuplicateMatch[];
}

export async function findImportDuplicates(params: {
  organizationId: string;
  number: string;
  institution?: string | null;
  oficioDate: string;
  originalName: string;
  fileHash: string;
}): Promise<DuplicateResult> {
  const hard: DuplicateMatch[] = [];
  const soft: DuplicateMatch[] = [];
  const seen = new Set<string>();

  const sameNumber = await prisma.oficio.findFirst({
    where: {
      ...oficioTenantScope(params.organizationId),
      number: { equals: params.number, mode: 'insensitive' },
    },
    select: { id: true, number: true, institution: true },
  });
  if (sameNumber) {
    soft.push({
      id: sameNumber.id,
      number: sameNumber.number,
      reason: `Mismo número: ${sameNumber.number}`,
      field: 'number',
    });
    seen.add(sameNumber.id);
  }

  if (params.institution) {
    const sameInst = await prisma.oficio.findFirst({
      where: {
        ...oficioTenantScope(params.organizationId),
        institution: { equals: params.institution, mode: 'insensitive' },
        oficioDate: new Date(params.oficioDate),
      },
      select: { id: true, number: true, institution: true },
    });
    if (sameInst && !seen.has(sameInst.id)) {
      soft.push({
        id: sameInst.id,
        number: sameInst.number,
        reason: `Misma institución y fecha: ${sameInst.number}`,
        field: 'institution+date',
      });
      seen.add(sameInst.id);
    }
  }

  const sameHash = await prisma.oficioDocument.findFirst({
    where: { ...oficioDocumentTenantScope(params.organizationId), fileHash: params.fileHash },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameHash && !seen.has(sameHash.oficioId)) {
    hard.push({
      id: sameHash.oficioId,
      number: sameHash.oficio.number,
      reason: `Mismo contenido de archivo en oficio ${sameHash.oficio.number}`,
      field: 'fileHash',
    });
    seen.add(sameHash.oficioId);
  }

  const sameName = await prisma.oficioDocument.findFirst({
    where: {
      oficio: oficioTenantScope(params.organizationId),
      originalName: { equals: params.originalName, mode: 'insensitive' },
    },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameName && !seen.has(sameName.oficioId)) {
    soft.push({
      id: sameName.oficioId,
      number: sameName.oficio.number,
      reason: `Mismo nombre de archivo en oficio ${sameName.oficio.number}`,
      field: 'originalName',
    });
    seen.add(sameName.oficioId);
  }

  return { hard, soft };
}

export async function findBatchImportDuplicates(params: {
  organizationId: string;
  number: string;
  institution?: string | null;
  oficioDate: string;
  originalName: string;
  fileHash: string;
}): Promise<Array<{ field: string; reason: string }>> {
  const results: Array<{ field: string; reason: string }> = [];

  const sameNumber = await prisma.oficio.findFirst({
    where: {
      ...oficioTenantScope(params.organizationId),
      number: { equals: params.number, mode: 'insensitive' },
    },
    select: { id: true, number: true },
  });
  if (sameNumber) results.push({ field: 'number', reason: `Mismo número: ${sameNumber.number}` });

  if (params.institution) {
    const sameInst = await prisma.oficio.findFirst({
      where: {
        ...oficioTenantScope(params.organizationId),
        institution: { equals: params.institution, mode: 'insensitive' },
        oficioDate: new Date(params.oficioDate),
      },
      select: { id: true, number: true },
    });
    if (sameInst) {
      results.push({
        field: 'institution+date',
        reason: `Misma institución y fecha: ${sameInst.number}`,
      });
    }
  }

  const sameHash = await prisma.oficioDocument.findFirst({
    where: { ...oficioDocumentTenantScope(params.organizationId), fileHash: params.fileHash },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameHash) {
    results.push({ field: 'fileHash', reason: `Mismo archivo en oficio ${sameHash.oficio.number}` });
  }

  const sameName = await prisma.oficioDocument.findFirst({
    where: {
      ...oficioDocumentTenantScope(params.organizationId),
      originalName: { equals: params.originalName, mode: 'insensitive' },
    },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameName) {
    results.push({ field: 'originalName', reason: `Mismo nombre en oficio ${sameName.oficio.number}` });
  }

  return results;
}

export async function createHistoricalImportOficio(
  data: Prisma.OficioUncheckedCreateInput,
) {
  return prisma.oficio.create({
    data,
    include: {
      documents: true,
      tracking: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function createImportBatch(
  data: Prisma.OficioImportBatchUncheckedCreateInput,
) {
  return prisma.oficioImportBatch.create({ data });
}

export async function updateImportBatch(
  organizationId: string,
  batchId: string,
  data: Prisma.OficioImportBatchUpdateManyMutationInput,
) {
  return prisma.oficioImportBatch.updateMany({
    where: oficioBatchScope(organizationId, batchId),
    data,
  });
}

export async function createImportBatchItem(
  data: Prisma.OficioImportBatchItemUncheckedCreateInput,
) {
  return prisma.oficioImportBatchItem.create({ data });
}

export async function findImportBatchById(organizationId: string, batchId: string) {
  return prisma.oficioImportBatch.findFirst({
    where: oficioBatchScope(organizationId, batchId),
    include: {
      performedBy: { select: { id: true, firstName: true, lastName: true } },
      items: { orderBy: { rowIndex: 'asc' } },
    },
  });
}

export async function listImportBatches(organizationId: string, limit: number) {
  return prisma.oficioImportBatch.findMany({
    where: { ...oficioBatchTenantScope(organizationId), archivedAt: null },
    take: limit,
    orderBy: { startedAt: 'desc' },
    include: {
      performedBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function findImportBatchForDocuments(organizationId: string, batchId: string) {
  return prisma.oficioImportBatch.findFirst({
    where: oficioBatchScope(organizationId, batchId),
    include: {
      items: {
        where: { status: 'IMPORTED', oficioId: { not: null } },
        select: { oficioId: true, number: true },
      },
    },
  });
}

export async function createOficioDocumentRecord(
  data: Prisma.OficioDocumentUncheckedCreateInput,
) {
  return prisma.oficioDocument.create({ data });
}

export async function clearPrimaryDocumentsExcept(oficioId: string, documentId: string) {
  return prisma.oficioDocument.updateMany({
    where: { oficioId, NOT: { id: documentId } },
    data: { isPrimary: false },
  });
}
