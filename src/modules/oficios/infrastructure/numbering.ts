import type { Prisma } from '@prisma/client';
import { formatOficioNumber, type OficioDirection, type OficioScope } from '@/lib/oficios-numbering';
import { allocateDocumentSequence } from '@/platform/sequences/document-sequence';

export async function allocateOficioNumber(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; scope: OficioScope; direction: OficioDirection; year: number },
) {
  const sequence = await allocateDocumentSequence(tx, {
    organizationId: input.organizationId,
    documentType: 'OFFICE_DOCUMENT',
    year: input.year,
  });

  return formatOficioNumber({
    scope: input.scope,
    direction: input.direction,
    sequence,
    year: input.year,
  });
}
