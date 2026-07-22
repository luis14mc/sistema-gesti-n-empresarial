import type { DisposalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { disposalScope } from './tenant-scope';

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
