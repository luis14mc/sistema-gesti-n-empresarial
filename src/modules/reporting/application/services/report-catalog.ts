import type { OrganizationRole } from '@prisma/client';
import { ReportNotFoundError } from '../../domain/errors';
import type { ReportDefinition, ReportFilterDefinition, ReportCode } from '../../domain/report-types';
import { can, organizationRole } from '@/platform/security/authorization/permissions';

const DATE_RANGE_FILTER: ReportFilterDefinition = {
  key: 'dateRange',
  label: 'Rango de fechas',
  type: 'date-range',
  required: true,
};

const STATUS_FILTER: ReportFilterDefinition = {
  key: 'status',
  label: 'Estado',
  type: 'select',
  required: false,
};

const CATEGORY_FILTER: ReportFilterDefinition = {
  key: 'category',
  label: 'Categoría',
  type: 'select',
  required: false,
};

const TYPE_FILTER: ReportFilterDefinition = {
  key: 'type',
  label: 'Tipo',
  type: 'select',
  required: false,
};

const TABULAR_FORMATS = ['CSV', 'XLSX'] as const;

export const REPORT_CATALOG = [
  { code: 'DASHBOARD_EXECUTIVE', name: 'Tablero ejecutivo', description: 'Resumen ejecutivo de correspondencia, equipos, compras y operaciones.', module: 'dashboard', requiredPermission: 'dashboard.executive', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'PURCHASE_ORDER_SUMMARY', name: 'Resumen de órdenes de compra', description: 'Órdenes y valores canónicos por estado y período.', module: 'purchases', requiredPermission: 'reports.financial.purchases', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER, STATUS_FILTER], available: true },
  { code: 'PURCHASE_ORDER_TAX_ANALYSIS', name: 'Análisis tributario de compras', description: 'Base gravable, descuentos e ISV por tasa.', module: 'purchases', requiredPermission: 'reports.financial.purchases', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'PURCHASE_ORDER_SUPPLIER_ANALYSIS', name: 'Análisis de compras por proveedor', description: 'Totales de compra agrupados por proveedor.', module: 'purchases', requiredPermission: 'reports.financial.purchases', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'OFFICE_REGISTER', name: 'Registro de oficios', description: 'Detalle cronológico de oficios de la organización.', module: 'offices', requiredPermission: 'reports.view', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER, TYPE_FILTER, STATUS_FILTER], available: true },
  { code: 'OFFICE_DIRECTION_SUMMARY', name: 'Resumen de oficios por dirección', description: 'Distribución por dirección, tipo y estado sin inferencias por etiqueta.', module: 'offices', requiredPermission: 'reports.view', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'EQUIPMENT_INVENTORY', name: 'Inventario de equipos', description: 'Inventario institucional por categoría, estado y departamento.', module: 'equipment', requiredPermission: 'reports.view', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER, STATUS_FILTER, CATEGORY_FILTER], available: true },
  { code: 'EQUIPMENT_STATUS_SUMMARY', name: 'Resumen de estado de equipos', description: 'Distribución de equipos por estado operativo.', module: 'equipment', requiredPermission: 'reports.view', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'EQUIPMENT_ASSIGNMENT_HISTORY', name: 'Historial de asignaciones', description: 'Historial de custodia y duración de asignaciones.', module: 'equipment', requiredPermission: 'reports.view', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER, STATUS_FILTER], available: true },
  { code: 'EQUIPMENT_MAINTENANCE_COST', name: 'Costo de mantenimiento', description: 'Costos y frecuencia de mantenimiento por equipo.', module: 'equipment', requiredPermission: 'reports.financial.equipment', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'EQUIPMENT_DISPOSAL_SUMMARY', name: 'Resumen de bajas de equipos', description: 'Resultados, puntuaciones y tiempos del proceso de baja.', module: 'disposals', requiredPermission: 'reports.view', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER, STATUS_FILTER], available: true },
  { code: 'EQUIPMENT_REPLACEMENT_PROJECTION', name: 'Proyección de reemplazo', description: 'Demanda y monto proyectado para reemplazo de equipos.', module: 'disposals', requiredPermission: 'reports.financial.equipment', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'AUDIT_ACTIVITY', name: 'Actividad de auditoría institucional', description: 'Auditorías, hallazgos y acciones correctivas institucionales.', module: 'audit', requiredPermission: 'reports.audit', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'USER_ACTIVITY', name: 'Actividad de usuarios', description: 'Actividad operacional de miembros de la organización.', module: 'users', requiredPermission: 'reports.audit', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
  { code: 'SYSTEM_AUDIT_EVENTS', name: 'Eventos de auditoría del sistema', description: 'Eventos técnicos y de seguridad separados de la auditoría institucional.', module: 'audit', requiredPermission: 'reports.audit', supportedFormats: TABULAR_FORMATS, filters: [DATE_RANGE_FILTER], available: false },
] as const satisfies readonly ReportDefinition[];

const REPORTS_BY_CODE = new Map<ReportCode, ReportDefinition>(
  REPORT_CATALOG.map((definition) => [definition.code, definition]),
);

export function getReportDefinition(code: ReportCode): ReportDefinition {
  const definition = REPORTS_BY_CODE.get(code);
  if (!definition) throw new ReportNotFoundError(code);
  return definition;
}

export function getAvailableReportDefinition(code: ReportCode): ReportDefinition {
  const definition = getReportDefinition(code);
  if (!definition.available) throw new ReportNotFoundError(code);
  return definition;
}

export function listAvailableReports(role: OrganizationRole): readonly ReportDefinition[] {
  return REPORT_CATALOG.filter(
    (definition) => definition.available && can(organizationRole(role), definition.requiredPermission),
  );
}
