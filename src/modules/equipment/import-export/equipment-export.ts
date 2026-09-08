import type { EquipmentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toXlsx } from '@/platform/reporting/export/xlsx';

const formulaPrefix = /^[=+\-@]/;
export function safeSpreadsheetText(value: string | null | undefined): string {
  if (!value) return '';
  return formulaPrefix.test(value) ? `'${value}` : value;
}

export async function buildEquipmentExport(input: {
  organizationId: string;
  organizationName?: string;
  search?: string;
  status?: EquipmentStatus;
  type?: string;
}) {
  const where: Prisma.EquipmentWhereInput = { organizationId: input.organizationId };
  if (input.status) where.status = input.status;
  if (input.type) where.category = input.type as Prisma.EnumEquipmentCategoryFilter['equals'];
  if (input.search) where.OR = [
    { inventoryCode: { contains: input.search, mode: 'insensitive' } },
    { brand: { contains: input.search, mode: 'insensitive' } },
    { model: { contains: input.search, mode: 'insensitive' } },
    { serialNumber: { contains: input.search, mode: 'insensitive' } },
  ];
  const equipment = await prisma.equipment.findMany({ where, orderBy: { inventoryCode: 'asc' } });
  const date = new Date();
  const dataset = {
    reportTitle: 'Inventario de Equipos CNI',
    baseFilename: `Inventario_Equipos_CNI_${date.toISOString().slice(0, 10)}`,
    organizationName: input.organizationName,
    generatedAt: date,
    appliedFilters: input.search || input.status || input.type ? {
      Búsqueda: input.search || 'Todas', Estado: input.status || 'Todos', Tipo: input.type || 'Todos',
    } : undefined,
    columns: [
      ['inventoryCode', 'Número de inventario', 'text', 24], ['status', 'Estado', 'text', 16],
      ['type', 'Tipo', 'text', 18], ['brand', 'Marca', 'text', 18], ['model', 'Modelo', 'text', 22],
      ['serialNumber', 'Número de serie', 'text', 22], ['purchaseDate', 'Fecha de compra', 'date', 18],
      ['processor', 'Procesador', 'text', 24], ['ram', 'RAM', 'text', 15], ['storage', 'Almacenamiento', 'text', 20],
      ['os', 'Sistema operativo', 'text', 24], ['includedAccessories', 'Accesorios incluidos', 'text', 28],
      ['installedSoftware', 'Software instalado', 'text', 28], ['notes', 'Comentarios', 'text', 32],
      ['createdAt', 'Fecha de creación', 'date', 20],
    ].map(([key, header, type, width]) => ({ key: String(key), header: String(header), type: type as 'text' | 'date', width: Number(width) })),
    rows: equipment.map((item) => ({
      inventoryCode: safeSpreadsheetText(item.inventoryCode), status: item.status, type: item.category,
      brand: safeSpreadsheetText(item.brand), model: safeSpreadsheetText(item.model), serialNumber: safeSpreadsheetText(item.serialNumber),
      purchaseDate: item.purchaseDate, processor: safeSpreadsheetText(item.processor), ram: safeSpreadsheetText(item.ram),
      storage: safeSpreadsheetText(item.storage), os: safeSpreadsheetText(item.os), includedAccessories: safeSpreadsheetText(item.includedAccessories),
      installedSoftware: safeSpreadsheetText(item.installedSoftware), notes: safeSpreadsheetText(item.notes), createdAt: item.createdAt,
    })),
  } as const;
  return { artifact: await toXlsx(dataset), exportedRows: equipment.length };
}
