import type { DocumentType, Prisma } from '@prisma/client';
import { SequenceAllocationFailedError } from '@/platform/domain/errors';

export type AllocateDocumentSequenceInput = {
  organizationId: string;
  documentType: DocumentType;
  year: number;
};

export async function allocateDocumentSequence(
  tx: Prisma.TransactionClient,
  input: AllocateDocumentSequenceInput,
): Promise<number> {
  try {
    const sequence = await tx.documentSequence.upsert({
      where: {
        organizationId_documentType_year: {
          organizationId: input.organizationId,
          documentType: input.documentType,
          year: input.year,
        },
      },
      create: { ...input, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });
    return sequence.lastValue;
  } catch (cause) {
    throw new SequenceAllocationFailedError(input, { cause });
  }
}
