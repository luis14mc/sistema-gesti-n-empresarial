import { prisma } from '@/lib/prisma';
import { normalizeOficioDependency } from '@/modules/oficios/domain/oficios-numbering';

export function parseSignerDependency(value: unknown): string | null {
  if (value == null || value === '' || value === 'ALL' || value === 'null') return null;
  return normalizeOficioDependency(String(value));
}

export async function listOficioSigners(params: {
  organizationId: string;
  dependency?: string | null;
  activeOnly: boolean;
}) {
  const { organizationId, dependency, activeOnly } = params;
  return prisma.oficioSigner.findMany({
    where: {
      organizationId,
      ...(activeOnly ? { isActive: true } : {}),
      ...(dependency
        ? {
            OR: [
              { dependency: normalizeOficioDependency(dependency) },
              { dependency: null },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function createOficioSigner(params: {
  organizationId: string;
  actorUserId: string;
  name: string;
  positionTitle: string;
  dependency: string | null;
  isActive: boolean;
}) {
  return prisma.oficioSigner.create({
    data: {
      organizationId: params.organizationId,
      name: params.name,
      positionTitle: params.positionTitle,
      dependency: params.dependency,
      isActive: params.isActive,
      createdById: params.actorUserId,
    },
  });
}

export async function findOficioSignerById(organizationId: string, id: string) {
  return prisma.oficioSigner.findFirst({
    where: { id, organizationId },
  });
}

export async function updateOficioSigner(
  id: string,
  data: { name: string; positionTitle: string; dependency: string | null; isActive: boolean },
) {
  return prisma.oficioSigner.update({
    where: { id },
    data,
  });
}
