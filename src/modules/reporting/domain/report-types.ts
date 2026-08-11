import type { Permission } from '@/platform/security/authorization/permissions';

export const REPORT_CODES = [
  'DASHBOARD_EXECUTIVE',
  'PURCHASE_ORDER_SUMMARY',
  'PURCHASE_ORDER_TAX_ANALYSIS',
  'PURCHASE_ORDER_SUPPLIER_ANALYSIS',
  'OFFICE_REGISTER',
  'OFFICE_DIRECTION_SUMMARY',
  'EQUIPMENT_INVENTORY',
  'EQUIPMENT_STATUS_SUMMARY',
  'EQUIPMENT_ASSIGNMENT_HISTORY',
  'EQUIPMENT_MAINTENANCE_COST',
  'EQUIPMENT_DISPOSAL_SUMMARY',
  'EQUIPMENT_REPLACEMENT_PROJECTION',
  'AUDIT_ACTIVITY',
  'USER_ACTIVITY',
  'SYSTEM_AUDIT_EVENTS',
] as const;

export const REPORT_FORMATS = ['CSV', 'XLSX', 'PDF'] as const;

export type ReportCode = (typeof REPORT_CODES)[number];
export type ReportFormat = (typeof REPORT_FORMATS)[number];
export type ReportModule = 'dashboard' | 'purchases' | 'offices' | 'equipment' | 'disposals' | 'audit' | 'users';
export type ReportFilterType = 'date-range' | 'select' | 'multi-select' | 'text';

export type ReportFilterOption = Readonly<{ value: string; label: string }>;

export type ReportFilterDefinition = Readonly<{
  key: string;
  label: string;
  type: ReportFilterType;
  required: boolean;
  options?: readonly ReportFilterOption[];
}>;

export type ReportDefinition = Readonly<{
  code: ReportCode;
  name: string;
  description: string;
  module: ReportModule;
  requiredPermission: Permission;
  supportedFormats: readonly ReportFormat[];
  filters: readonly ReportFilterDefinition[];
}>;

export type ReportDateRange = Readonly<{
  from: string;
  to: string;
  timezone: string;
}>;

export type ReportPagination = Readonly<{
  page: number;
  pageSize: number;
}>;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type ReportFilters = Readonly<Record<string, JsonValue>>;

export type ReportResultMeta = Readonly<{
  reportCode: ReportCode;
  from: string;
  to: string;
  timezone: string;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}>;

export type ReportResult<TData> = Readonly<{
  data: TData;
  meta: ReportResultMeta;
}>;
