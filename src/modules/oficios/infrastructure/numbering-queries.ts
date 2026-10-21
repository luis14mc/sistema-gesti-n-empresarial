import { previewOficioNumber } from '@/modules/oficios/infrastructure/numbering';
import { oficiosDb } from '@/modules/oficios/infrastructure/prisma-client';
import type { OficioDependency } from '@/modules/oficios/domain/oficios-numbering';

export async function previewOficioNumberForOrganization(params: {
  organizationId: string;
  dependency: OficioDependency;
  year: number;
}) {
  return previewOficioNumber(oficiosDb, params);
}

export async function findNumberingConfigByKey(params: {
  organizationId: string;
  dependency: string;
  year: number;
}) {
  return oficiosDb.oficioNumberingConfig.findUnique({
    where: {
      organizationId_dependency_year: {
        organizationId: params.organizationId,
        dependency: params.dependency.toUpperCase(),
        year: params.year,
      },
    },
  });
}

export async function listActiveNumberingDependencies(organizationId: string) {
  return oficiosDb.oficioNumberingConfig.findMany({
    where: { organizationId, isActive: true },
    select: { dependency: true },
    distinct: ['dependency'],
  });
}

