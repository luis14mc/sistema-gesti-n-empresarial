import type { EquipmentCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { allocateDocumentSequence } from '@/platform/sequences/document-sequence';
import { CATEGORY_CODE_PREFIX } from '@/modules/equipment/domain/equipment-asset-code';

/**
 * Genera código interno `TI-{CATEGORY}-{NNNN}` atómicamente por organización.
 */
export async function generateAssetCode(
  organizationId: string,
  category: EquipmentCategory,
  client: Prisma.TransactionClient | typeof prisma = prisma,
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
