import type { DisposalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { disposalDocumentScope, disposalScope } from './tenant-scope';

const detailInclude = {
  equipment: { select: { id: true, inventoryCode: true, status: true } },
  evaluatedBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  documents: { orderBy: { createdAt: 'desc' as const } },
  history: { orderBy: { createdAt: 'desc' as const } },
  replacementProjection: true,
} satisfies Prisma.EquipmentDisposalInclude;

export function findDisposal(organizationId: string, id: string) {
  return prisma.equipmentDisposal.findFirst({
    where: disposalScope(organizationId, id),
    include: detailInclude,
  });
}

export async function listDisposals(input: {
  organizationId: string;
  page: number;
  pageSize: number;
  status?: DisposalStatus;
  search?: string;
}) {
  const where: Prisma.EquipmentDisposalWhereInput = {
    organizationId: input.organizationId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? {
      OR: [
        { folio: { contains: input.search, mode: 'insensitive' } },
        { serialNumber: { contains: input.search, mode: 'insensitive' } },
        { equipment: { inventoryCode: { contains: input.search, mode: 'insensitive' } } },
      ],
    } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.equipmentDisposal.findMany({
      where,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, folio: true, status: true, disposalResult: true, evaluationScore: true,
        serialNumber: true, brand: true, model: true, createdAt: true,
        equipment: { select: { inventoryCode: true } },
        _count: { select: { documents: true } },
      },
    }),
    prisma.equipmentDisposal.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(total / input.pageSize) };
}

export function findDisposalId(organizationId: string, id: string) {
  return prisma.equipmentDisposal.findFirst({ where: { id, organizationId }, select: { id: true } });
}

export function findEditableDisposalId(organizationId: string, id: string) {
  return prisma.equipmentDisposal.findFirst({ where: { id, organizationId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } }, select: { id: true } });
}

export function listDisposalDocuments(organizationId: string, disposalId: string) {
  return prisma.disposalDocument.findMany({ where: { disposalId, organizationId }, orderBy: { createdAt: 'desc' } });
}

export function findDisposalDocument(organizationId: string, disposalId: string, documentId: string) {
  return prisma.disposalDocument.findFirst({ where: disposalDocumentScope(organizationId, disposalId, documentId) });
}

export function findDraftDisposalDocument(organizationId: string, disposalId: string, documentId: string) {
  return prisma.disposalDocument.findFirst({ where: { ...disposalDocumentScope(organizationId, disposalId, documentId), disposal: { status: 'DRAFT' } } });
}

export function findApprovedDisposalPdf(organizationId: string, id: string) {
  return prisma.equipmentDisposal.findFirst({ where: { id, organizationId, status: 'APPROVED' }, select: { folio: true, pdfStorageKey: true } });
}

export type NewDisposalDocument = Omit<Prisma.DisposalDocumentUncheckedCreateInput, 'organizationId' | 'disposalId' | 'uploadedById'>;

/** Inserta el documento y su historial; `onDuplicate` lanza el error de dominio si el hash ya existe. */
export function insertDisposalDocument(
  input: { organizationId: string; disposalId: string; userId: string; requestId: string; data: NewDisposalDocument },
  onDuplicate: () => never,
) {
  const { organizationId, disposalId, userId, requestId, data } = input;
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.disposalDocument.findFirst({ where: { organizationId, disposalId, fileHash: data.fileHash } });
    if (duplicate) onDuplicate();
    const created = await tx.disposalDocument.create({ data: { organizationId, disposalId, ...data, uploadedById: userId } });
    await tx.equipmentDisposalHistory.create({ data: { organizationId, disposalId, action: 'DISPOSAL_DOCUMENT_UPLOADED', performedById: userId, requestId, newValues: { documentId: created.id, fileName: created.fileName } } });
    return created;
  });
}

export function deleteDisposalDocumentRecord(input: {
  organizationId: string;
  disposalId: string;
  userId: string;
  requestId: string;
  document: { id: string; fileName: string };
  documentId: string;
}) {
  const { organizationId, disposalId, userId, requestId, document, documentId } = input;
  return prisma.$transaction(async (tx) => {
    await tx.disposalDocument.delete({ where: { id: document.id } });
    await tx.equipmentDisposalHistory.create({ data: { organizationId, disposalId, action: 'DISPOSAL_DOCUMENT_DELETED', performedById: userId, requestId, previousValues: { documentId, fileName: document.fileName } } });
  });
}
