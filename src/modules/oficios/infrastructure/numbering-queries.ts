import {
  ensureDefaultNumberingConfigs,
  listNumberingConfigs,
  upsertNumberingConfig,
  type NumberingConfigInput,
} from '@/modules/oficios/application/numbering-config';
import { previewOficioNumber } from '@/modules/oficios/infrastructure/numbering';
import { prisma } from '@/lib/prisma';
import type { OficioDependency } from '@/modules/oficios/domain/oficios-numbering';

export async function previewOficioNumberForOrganization(params: {
  organizationId: string;
  dependency: OficioDependency;
  year: number;
}) {
  return previewOficioNumber(prisma, params);
}

export async function findNumberingConfigByKey(params: {
  organizationId: string;
  dependency: string;
  year: number;
}) {
  return prisma.oficioNumberingConfig.findUnique({
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
  return prisma.oficioNumberingConfig.findMany({
    where: { organizationId, isActive: true },
    select: { dependency: true },
    distinct: ['dependency'],
  });
}

export async function ensureDefaultNumberingConfigsForOrg(
  organizationId: string,
  actorUserId: string,
) {
  await ensureDefaultNumberingConfigs(prisma, organizationId, actorUserId);
}

export async function listNumberingConfigsForOrg(organizationId: string) {
  return listNumberingConfigs(prisma, organizationId);
}

export async function upsertNumberingConfigForOrg(
  organizationId: string,
  actorUserId: string,
  input: NumberingConfigInput,
) {
  return upsertNumberingConfig(prisma, organizationId, actorUserId, input);
}

