import type { EquipmentCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Prefijos TI por categoría de activo */
export const CATEGORY_CODE_PREFIX: Record<EquipmentCategory, string> = {
  DESKTOP_PC: 'PC',
  LAPTOP: 'LAP',
  PRINTER: 'IMP',
  PHONE: 'TEL',
  MONITOR: 'MON',
  UPS: 'UPS',
  ACCESSORY: 'ACC',
  OTHER: 'OTR',
};

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  DESKTOP_PC: 'PC de escritorio',
  LAPTOP: 'Laptop',
  PRINTER: 'Impresora',
  PHONE: 'Teléfono',
  MONITOR: 'Monitor',
  UPS: 'UPS',
  ACCESSORY: 'Accesorio',
  OTHER: 'Otro',
};

/** Mapea tipos legacy del formulario a categoría Prisma */
export function resolveEquipmentCategory(
  category?: EquipmentCategory | string,
  legacyType?: string
): EquipmentCategory {
  if (category && category in CATEGORY_CODE_PREFIX) {
    return category as EquipmentCategory;
  }

  const typeMap: Record<string, EquipmentCategory> = {
    DESKTOP: 'DESKTOP_PC',
    DESKTOP_PC: 'DESKTOP_PC',
    LAPTOP: 'LAPTOP',
    PRINTER: 'PRINTER',
    PHONE: 'PHONE',
    MONITOR: 'MONITOR',
    UPS: 'UPS',
    ACCESSORY: 'ACCESSORY',
    TABLET: 'OTHER',
    OTHER: 'OTHER',
  };

  const key = (legacyType || category || 'OTHER').toUpperCase();
  return typeMap[key] ?? 'OTHER';
}

/** Genera código interno tipo TI-LAP-0001 */
export async function generateAssetCode(category: EquipmentCategory): Promise<string> {
  const prefix = CATEGORY_CODE_PREFIX[category];
  const pattern = `TI-${prefix}-`;

  const existing = await prisma.equipment.findMany({
    where: { inventoryCode: { startsWith: pattern } },
    select: { inventoryCode: true },
    orderBy: { inventoryCode: 'desc' },
    take: 1,
  });

  let next = 1;
  if (existing.length > 0) {
    const match = existing[0].inventoryCode.match(/(\d+)$/);
    if (match) next = parseInt(match[1], 10) + 1;
  }

  return `${pattern}${String(next).padStart(4, '0')}`;
}
