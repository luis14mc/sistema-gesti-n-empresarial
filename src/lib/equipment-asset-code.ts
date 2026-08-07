import type { EquipmentCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { allocateDocumentSequence } from '@/platform/sequences/document-sequence';

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

/**
 * Genera código interno `TI-{CATEGORY}-{NNNN}` atómicamente por organización.
 *
 * Antes (A-1 HIGH): escaneaba `inventoryCode startsWith` globalmente (cross-tenant)
 * y calculaba el siguiente número con MAX+1 no atómico. Dos POSTs concurrentes
 * generaban el mismo código; uno fallaba con P2002 en el INSERT.
 *
 * Ahora: usa `allocateDocumentSequence` (upsert atómico sobre
 * `(organizationId, documentType, year)`). Garantiza unicidad por tenant.
 *
 * @param organizationId Tenant al que pertenece el equipo (obligatorio).
 * @param category Categoría del equipo.
 * @param client Cliente Prisma (default `prisma`) o `tx` dentro de transacción.
 */
export async function generateAssetCode(
  organizationId: string,
  category: EquipmentCategory,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  if (!organizationId) {
    throw new Error('[generateAssetCode] organizationId es obligatorio');
  }

  const prefix = CATEGORY_CODE_PREFIX[category];
  const year = new Date().getFullYear();
  const sequence = await allocateDocumentSequence(client, {
    organizationId,
    documentType: 'EQUIPMENT_ASSET_CODE',
    year,
  });
  return `TI-${prefix}-${String(sequence).padStart(4, '0')}`;
}
