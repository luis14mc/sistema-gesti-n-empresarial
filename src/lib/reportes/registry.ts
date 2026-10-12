import type { ReportExportCode } from './types';
import { buildEquipmentAssignmentHistoryExportDataset } from './equipment-assignment-history-export';
import { buildEquipmentDisposalSummaryExportDataset } from './equipment-disposal-summary-export';
import { buildEquipmentInventoryExportDataset } from './equipment-inventory-export';
import { buildOfficeRegisterExportDataset } from './office-register-export';
import { buildPurchaseOrderSummaryExportDataset } from './purchase-order-summary-export';
import type { ReportDatasetBuilder } from './types';

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
