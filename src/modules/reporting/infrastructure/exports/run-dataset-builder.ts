import { prisma } from '@/lib/prisma';
import type { ReportExportBuildParams, ReportExportCode } from '@/modules/reporting/application/exports/types';
import { REPORT_DATASET_BUILDERS } from '@/modules/reporting/infrastructure/exports/registry';

export function runReportDatasetBuilder(code: ReportExportCode, params: Omit<ReportExportBuildParams, 'prisma'>) {
  const builder = REPORT_DATASET_BUILDERS[code];
  return builder({ prisma, ...params });
}

export function findOrganizationName(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
}
