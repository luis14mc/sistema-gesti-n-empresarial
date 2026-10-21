import type { ReportCode, ReportDefinition, ReportModule } from '@/modules/reporting/domain/report-types';
import { COMPRA_ESTADO_LABELS } from '@/modules/purchases/domain/constants-legacy';
import {
  EQUIPMENT_STATUS_LABELS,
  OFICIO_STATUS_LABELS,
  OFICIO_TYPE_LABELS,
} from '@/types';

export type ReportDatePreset = 'this_month' | 'last_month' | 'this_year' | 'custom';

export type ReportUiGroupKey = 'purchases' | 'offices' | 'assets';

export const REPORT_UI_GROUPS: ReadonlyArray<{
  key: ReportUiGroupKey;
  label: string;
  modules: readonly ReportModule[];
}> = [
  { key: 'purchases', label: 'Compras', modules: ['purchases'] },
  { key: 'offices', label: 'Correspondencia', modules: ['offices'] },
  { key: 'assets', label: 'Activos', modules: ['equipment', 'disposals'] },
];

const FILTER_NONE = '__all__';

export type ReportFilterSelectKey = 'status' | 'category' | 'type';

export function reportFilterOptions(
  filterKey: ReportFilterSelectKey,
  reportCode: ReportCode,
): readonly { value: string; label: string }[] {
  const base = [{ value: FILTER_NONE, label: 'Todos' }];
  switch (filterKey) {
    case 'status':
      if (reportCode === 'PURCHASE_ORDER_SUMMARY') {
        return [
          ...base,
          ...Object.entries(COMPRA_ESTADO_LABELS).map(([value, label]) => ({ value, label })),
        ];
      }
      if (
        reportCode === 'EQUIPMENT_INVENTORY' ||
        reportCode === 'EQUIPMENT_STATUS_SUMMARY'
      ) {
        return [
          ...base,
          ...Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
        ];
      }
      if (reportCode === 'EQUIPMENT_ASSIGNMENT_HISTORY') {
        return [
          ...base,
          { value: 'ACTIVE', label: 'Activa' },
          { value: 'RETURNED', label: 'Devuelta' },
          { value: 'REPLACED', label: 'Reemplazada' },
          { value: 'LOST', label: 'Perdida' },
          { value: 'CANCELLED', label: 'Cancelada' },
        ];
      }
      if (reportCode === 'EQUIPMENT_DISPOSAL_SUMMARY') {
        return [
          ...base,
          { value: 'DRAFT', label: 'Borrador' },
          { value: 'PENDING_APPROVAL', label: 'Pendiente de aprobación' },
          { value: 'APPROVED', label: 'Aprobado' },
          { value: 'REJECTED', label: 'Rechazado' },
          { value: 'CANCELLED', label: 'Cancelado' },
        ];
      }
      if (reportCode === 'OFFICE_REGISTER') {
        return [
          ...base,
          ...Object.entries(OFICIO_STATUS_LABELS).map(([value, label]) => ({ value, label })),
        ];
      }
      return base;
    case 'category':
      if (reportCode === 'EQUIPMENT_INVENTORY') {
        return [
          ...base,
          { value: 'DESKTOP_PC', label: 'PC de escritorio' },
          { value: 'LAPTOP', label: 'Laptop' },
          { value: 'PRINTER', label: 'Impresora' },
          { value: 'PHONE', label: 'Teléfono' },
          { value: 'MONITOR', label: 'Monitor' },
          { value: 'UPS', label: 'UPS' },
          { value: 'ACCESSORY', label: 'Accesorio' },
          { value: 'OTHER', label: 'Otro' },
        ];
      }
      return base;
    case 'type':
      if (reportCode === 'OFFICE_REGISTER') {
        return [
          ...base,
          ...Object.entries(OFICIO_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        ];
      }
      return base;
    default:
      return base;
  }
}

export function isReportFilterSelectKey(key: string): key is ReportFilterSelectKey {
  return key === 'status' || key === 'category' || key === 'type';
}

export function filterValueForExport(value: string | undefined): string | undefined {
  if (!value || value === FILTER_NONE) return undefined;
  return value;
}

export function formatCivilDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveDatePreset(preset: Exclude<ReportDatePreset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === 'this_month') {
    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0);
    return { from: formatCivilDate(from), to: formatCivilDate(to) };
  }

  if (preset === 'last_month') {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);
    return { from: formatCivilDate(from), to: formatCivilDate(to) };
  }

  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31);
  return { from: formatCivilDate(from), to: formatCivilDate(to) };
}

export function defaultExportFilename(code: ReportCode, from: string, to: string, format: 'csv' | 'xlsx'): string {
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  return `${code.toLowerCase()}_${from}_${to}.${ext}`;
}

export function groupReportsByUiSection(
  reports: readonly ReportDefinition[],
): Map<ReportUiGroupKey, ReportDefinition[]> {
  const map = new Map<ReportUiGroupKey, ReportDefinition[]>(
    REPORT_UI_GROUPS.map((g) => [g.key, []]),
  );

  for (const report of reports) {
    const group = REPORT_UI_GROUPS.find((g) => g.modules.includes(report.module));
    if (group) {
      map.get(group.key)!.push(report);
    }
  }

  for (const [, list] of map) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  return map;
}

export { FILTER_NONE };
