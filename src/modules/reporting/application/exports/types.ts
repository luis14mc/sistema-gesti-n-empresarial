import type { PrismaClient } from '@prisma/client';
import type { ExportDataset } from '@/platform/reporting/export';
import type { ReportCode } from '@/modules/reporting/domain/report-types';

export type ReportExportFilters = Readonly<{
  status?: string;
  category?: string;
  type?: string;
}>;

export type ReportExportBuildParams = Readonly<{
  prisma: PrismaClient;
  organizationId: string;
  organizationName?: string;
  from: string;
  to: string;
  filters?: ReportExportFilters;
  now?: Date;
}>;

export type ReportDatasetBuilder = (params: ReportExportBuildParams) => Promise<ExportDataset>;

export type ReportExportCode = Extract<
  ReportCode,
  | 'PURCHASE_ORDER_SUMMARY'
  | 'EQUIPMENT_INVENTORY'
  | 'OFFICE_REGISTER'
  | 'EQUIPMENT_ASSIGNMENT_HISTORY'
  | 'EQUIPMENT_DISPOSAL_SUMMARY'
>;
