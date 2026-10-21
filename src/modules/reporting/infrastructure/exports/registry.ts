import type { ReportExportCode } from '@/modules/reporting/application/exports/types';
import { buildEquipmentAssignmentHistoryExportDataset } from '@/modules/reporting/infrastructure/exports/equipment-assignment-history-export';
import { buildEquipmentDisposalSummaryExportDataset } from '@/modules/reporting/infrastructure/exports/equipment-disposal-summary-export';
import { buildEquipmentInventoryExportDataset } from '@/modules/reporting/infrastructure/exports/equipment-inventory-export';
import { buildOfficeRegisterExportDataset } from '@/modules/reporting/infrastructure/exports/office-register-export';
import { buildPurchaseOrderSummaryExportDataset } from '@/modules/reporting/infrastructure/exports/purchase-order-summary-export';
import type { ReportDatasetBuilder } from '@/modules/reporting/application/exports/types';

export const REPORT_DATASET_BUILDERS: Record<ReportExportCode, ReportDatasetBuilder> = {
  PURCHASE_ORDER_SUMMARY: buildPurchaseOrderSummaryExportDataset,
  EQUIPMENT_INVENTORY: buildEquipmentInventoryExportDataset,
  OFFICE_REGISTER: buildOfficeRegisterExportDataset,
  EQUIPMENT_ASSIGNMENT_HISTORY: buildEquipmentAssignmentHistoryExportDataset,
  EQUIPMENT_DISPOSAL_SUMMARY: buildEquipmentDisposalSummaryExportDataset,
};

export function isExportableReportCode(code: string): code is ReportExportCode {
  return code in REPORT_DATASET_BUILDERS;
}
