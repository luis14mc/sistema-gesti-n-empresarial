import type { EquipmentCategory } from '@prisma/client';

export const EQUIPMENT_EXCEL_TYPES = [
  'LAPTOP',
  'DESKTOP_PC',
  'MONITOR',
  'PRINTER',
  'PHONE',
  'UPS',
  'ACCESSORY',
  'OTHER',
] as const satisfies readonly EquipmentCategory[];

export type EquipmentExcelType = (typeof EQUIPMENT_EXCEL_TYPES)[number];

export const EQUIPMENT_IMPORT_HEADERS = [
  'Número de inventario',
  'Tipo',
  'Marca',
  'Modelo',
  'Número de serie',
  'Fecha de compra',
  'Procesador',
  'RAM',
  'Almacenamiento',
  'Sistema operativo',
  'Accesorios incluidos',
  'Software instalado',
  'Comentarios',
] as const;

export type EquipmentImportError = {
  row: number;
  field: string;
  code: string;
  message: string;
};

export type EquipmentImportRow = {
  row: number;
  inventoryCode?: string;
  type: EquipmentExcelType;
  brand: string;
  model: string;
  serialNumber?: string;
  purchaseDate?: Date;
  processor?: string;
  ram?: string;
  storage?: string;
  os?: string;
  includedAccessories?: string;
  installedSoftware?: string;
  notes?: string;
};

export type EquipmentImportResult = {
  totalRows: number;
  imported: number;
  skipped: number;
  errors: EquipmentImportError[];
};
