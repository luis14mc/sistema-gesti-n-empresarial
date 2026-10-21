import { ImportBatchNotFoundError } from '@/modules/oficios/domain/errors';
import {
  findImportBatchById,
  listImportBatches,
} from '@/modules/oficios/infrastructure/oficio-import-repository';

export async function listImportBatchesUseCase(params: {
  organizationId: string;
  limit: number;
  batchId: string | null;
}) {
  if (params.batchId) {
    const batch = await findImportBatchById(params.organizationId, params.batchId);
    if (!batch) {
      throw new ImportBatchNotFoundError();
    }
    return { batch };
  }

  const batches = await listImportBatches(params.organizationId, params.limit);
  return { batches };
}
