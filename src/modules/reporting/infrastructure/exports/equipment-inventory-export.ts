import type { EquipmentCategory, EquipmentStatus, Prisma } from '@prisma/client';
import type { ExportColumn, ExportDataset } from '@/platform/reporting/export';
import { SYNC_EXPORT_ROW_LIMIT } from '@/platform/reporting/export';
import { EQUIPMENT_STATUS_LABELS, type EquipmentStatus as UiEquipmentStatus } from '@/types';
import { ReportExportTooLargeError } from '@/modules/reporting/domain/export-errors';
import type { ReportExportBuildParams } from '@/modules/reporting/application/exports/types';

const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  DESKTOP_PC: 'PC de escritorio',
  LAPTOP: 'Laptop',
  PRINTER: 'Impresora',
  PHONE: 'Teléfono',
  MONITOR: 'Monitor',
  UPS: 'UPS',
  ACCESSORY: 'Accesorio',
  OTHER: 'Otro',
};

const COLUMNS: readonly ExportColumn[] = [
  { key: 'inventoryCode', header: 'Código de activo', type: 'text', width: 18 },
  { key: 'category', header: 'Categoría', type: 'text', width: 14 },
  { key: 'brand', header: 'Marca', type: 'text', width: 16 },
  { key: 'model', header: 'Modelo', type: 'text', width: 18 },
  { key: 'serialNumber', header: 'Serie', type: 'text', width: 18 },
  { key: 'status', header: 'Estado', type: 'text', width: 14 },
  { key: 'assigneeName', header: 'Asignado a', type: 'text', width: 22 },
  { key: 'assigneeDepartment', header: 'Departamento', type: 'text', width: 20 },
  { key: 'purchaseDate', header: 'Fecha adquisición', type: 'date', width: 14 },
];

const VALID_STATUSES = new Set<string>(['AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'RETIRED', 'LOST']);
const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABEL));

export async function buildEquipmentInventoryExportDataset(
  params: ReportExportBuildParams,
): Promise<ExportDataset> {
  const { prisma, organizationId, organizationName, from, to, filters } = params;
  const status = filters?.status;
  const category = filters?.category;
  if (status && !VALID_STATUSES.has(status)) throw new Error('INVALID_STATUS');
  if (category && !VALID_CATEGORIES.has(category)) throw new Error('INVALID_CATEGORY');

  const where: Prisma.EquipmentWhereInput = {
    organizationId,
    purchaseDate: {
      gte: new Date(`${from}T00:00:00.000Z`),
      lte: new Date(`${to}T00:00:00.000Z`),
    },
    ...(status ? { status: status as EquipmentStatus } : {}),
    ...(category ? { category: category as EquipmentCategory } : {}),
  };

  const total = await prisma.equipment.count({ where });
  if (total > SYNC_EXPORT_ROW_LIMIT) throw new ReportExportTooLargeError(SYNC_EXPORT_ROW_LIMIT);

  const items = await prisma.equipment.findMany({
    where,
    orderBy: [{ inventoryCode: 'asc' }],
    take: SYNC_EXPORT_ROW_LIMIT,
    select: {
      inventoryCode: true,
      category: true,
      brand: true,
      model: true,
      serialNumber: true,
      status: true,
      purchaseDate: true,
      assignments: {
        where: { status: 'ACTIVE' },
        take: 1,
        select: {
          employeeNameSnapshot: true,
          employeeNameAtTime: true,
          departmentSnapshot: true,
          departmentAtTime: true,
        },
      },
    },
  });

  let rowCount = 0;
  const rows = items.map((item) => {
    rowCount += 1;
    const active = item.assignments[0];
    return {
      inventoryCode: item.inventoryCode,
      category: CATEGORY_LABEL[item.category],
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber ?? '—',
      status: EQUIPMENT_STATUS_LABELS[item.status as UiEquipmentStatus] ?? item.status,
      assigneeName: active?.employeeNameSnapshot ?? active?.employeeNameAtTime ?? '—',
      assigneeDepartment: active?.departmentSnapshot ?? active?.departmentAtTime ?? '—',
      purchaseDate: item.purchaseDate,
    };
  });

  const appliedFilters: Record<string, string> = { Desde: from, Hasta: to };
  if (status) appliedFilters.Estado = EQUIPMENT_STATUS_LABELS[status as UiEquipmentStatus] ?? status;
  if (category) appliedFilters.Categoría = CATEGORY_LABEL[category as EquipmentCategory] ?? category;

  return {
    reportTitle: 'Inventario de equipos',
    baseFilename: `inventario-equipos-${from}_${to}`,
    organizationName,
    generatedAt: params.now ?? new Date(),
    appliedFilters,
    columns: COLUMNS,
    rows,
    summary: { inventoryCode: 'TOTAL', assigneeName: `${rowCount} equipos` },
  };
}
