import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { OficioBadRequestError } from '@/modules/oficios/domain/errors';
import {
  createHistoricalImportOficio,
  createImportBatch,
  createImportBatchItem,
  findBatchImportDuplicates,
  updateImportBatch,
} from '@/modules/oficios/infrastructure/oficio-import-repository';
import { saveOficioDocument } from '@/modules/oficios/infrastructure/oficios-storage';

interface BatchItemPayload {
  number: string;
  scope?: string;
  type?: 'INCOMING' | 'OUTGOING' | 'INTERNAL_MEMO';
  recipient?: string;
  institution?: string;
  preparedBy?: string;
  motivo: string;
  oficioDate: string;
  receivedDate?: string;
  status?: 'DRAFT' | 'SENT' | 'RECEIVED' | 'IN_PROCESS' | 'COMPLETED' | 'ARCHIVED';
  documentType?: string;
  comments?: string;
}

interface BatchItemResult {
  rowIndex: number;
  fileName: string;
  status: 'IMPORTED' | 'SKIPPED' | 'ERROR';
  oficioId?: string;
  number?: string;
  duplicates?: Array<{ reason: string }>;
  error?: string;
}

const MAX_FILES = 25;

function validatePayload(p: BatchItemPayload): string[] {
  const errors: string[] = [];
  if (!p.number?.trim()) errors.push('Número obligatorio');
  if (!p.motivo?.trim()) errors.push('Motivo obligatorio');
  if (!p.oficioDate) errors.push('Fecha original obligatoria');
  if (!p.recipient?.trim()) errors.push('Destinatario obligatorio');
  if (!p.institution?.trim()) errors.push('Institución obligatoria');
  if (!p.preparedBy?.trim()) errors.push('Elaborado por obligatorio');
  return errors;
}

async function processItem(params: {
  batchId: string;
  rowIndex: number;
  item: BatchItemPayload;
  file: File;
  userId: string;
  organizationId: string;
}): Promise<BatchItemResult> {
  const { batchId, rowIndex, item, file, userId, organizationId } = params;

  try {
    const validationErrors = validatePayload(item);
    if (validationErrors.length > 0) {
      await createImportBatchItem({
        batchId,
        rowIndex,
        status: 'ERROR',
        originalName: file.name,
        number: item.number,
        institution: item.institution,
        oficioDate: item.oficioDate ? new Date(item.oficioDate) : null,
        errorMessage: validationErrors.join('; '),
      });
      return { rowIndex, fileName: file.name, status: 'ERROR', error: validationErrors.join('; ') };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    const duplicates = await findBatchImportDuplicates({
      organizationId,
      number: item.number,
      institution: item.institution,
      oficioDate: item.oficioDate,
      originalName: file.name,
      fileHash,
    });

    if (duplicates.some((d) => d.field === 'fileHash')) {
      await createImportBatchItem({
        batchId,
        rowIndex,
        status: 'SKIPPED',
        originalName: file.name,
        number: item.number,
        institution: item.institution,
        oficioDate: item.oficioDate ? new Date(item.oficioDate) : null,
        fileHash,
        errorMessage: 'Archivo ya importado (hash duplicado)',
      });
      return {
        rowIndex,
        fileName: file.name,
        status: 'SKIPPED',
        number: item.number,
        duplicates: duplicates.map((d) => ({ reason: d.reason })),
        error: 'Archivo ya importado (hash duplicado)',
      };
    }

    const stored = await saveOficioDocument(file, organizationId);

    const oficio = await createHistoricalImportOficio({
      organizationId,
      number: item.number.trim(),
      type: item.type ?? 'INCOMING',
      scope: item.scope ?? null,
      subject: item.motivo.trim(),
      recipient: item.recipient?.trim() || null,
      institution: item.institution?.trim() || null,
      preparedBy: item.preparedBy?.trim() || null,
      status: item.status ?? 'RECEIVED',
      oficioDate: new Date(item.oficioDate),
      receivedDate: item.receivedDate ? new Date(item.receivedDate) : new Date(),
      recordSource: 'HISTORICAL_IMPORT',
      importedById: userId,
      importedAt: new Date(),
      comments: item.comments?.trim() || null,
      createdById: userId,
      documents: {
        create: {
          filename: stored.filename,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
          originalSizeBytes: stored.originalSizeBytes ?? null,
          storedSizeBytes: stored.storedSizeBytes ?? stored.size,
          optimized: stored.optimized ?? false,
          signedPdf: stored.signedPdf ?? false,
          storageKey: stored.storageKey,
          url: stored.url,
          fileHash: stored.fileHash ?? fileHash,
          documentType: item.documentType ?? 'OFICIO_PRINCIPAL',
          isPrimary: true,
          uploadedById: userId,
        },
      },
      tracking: {
        create: {
          action: 'IMPORTED',
          title: 'Oficio importado (batch)',
          description: `Importado en batch ${batchId}`,
          performedById: userId,
          newData: { batchId, number: item.number, fileHash, originalName: file.name },
        },
      },
    } as Prisma.OficioUncheckedCreateInput);

    await createImportBatchItem({
      batchId,
      rowIndex,
      status: 'IMPORTED',
      originalName: file.name,
      number: item.number,
      institution: item.institution,
      oficioDate: item.oficioDate ? new Date(item.oficioDate) : null,
      fileHash,
      oficioId: oficio.id,
    });

    return {
      rowIndex,
      fileName: file.name,
      status: 'IMPORTED',
      oficioId: oficio.id,
      number: oficio.number,
      duplicates: duplicates.length > 0 ? duplicates.map((d) => ({ reason: d.reason })) : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    try {
      await createImportBatchItem({
        batchId,
        rowIndex,
        status: 'ERROR',
        originalName: file.name,
        number: item.number,
        institution: item.institution,
        oficioDate: item.oficioDate ? new Date(item.oficioDate) : null,
        errorMessage: message.slice(0, 500),
      });
    } catch (innerErr) {
      console.error('Error creando item de batch:', innerErr);
    }
    return { rowIndex, fileName: file.name, status: 'ERROR', error: message };
  }
}

export async function processImportBatchUseCase(params: {
  organizationId: string;
  actorUserId: string;
  items: BatchItemPayload[];
  files: File[];
  notes?: string;
}) {
  if (!Array.isArray(params.items) || params.items.length === 0) {
    throw new OficioBadRequestError('Batch sin ítems');
  }
  if (params.items.length > MAX_FILES) {
    throw new OficioBadRequestError(`Máximo ${MAX_FILES} archivos por batch`);
  }
  if (params.files.length !== params.items.length) {
    throw new OficioBadRequestError(
      `Cantidad de archivos (${params.files.length}) no coincide con items (${params.items.length})`,
    );
  }

  const batch = await createImportBatch({
    organizationId: params.organizationId,
    source: 'HISTORICAL_IMPORT',
    status: 'PROCESSING',
    totalFiles: params.files.length,
    imported: 0,
    skipped: 0,
    errors: 0,
    notes: params.notes?.trim() || null,
    performedById: params.actorUserId,
  } as Prisma.OficioImportBatchUncheckedCreateInput);

  const results: BatchItemResult[] = [];

  for (let i = 0; i < params.items.length; i++) {
    const row = await processItem({
      batchId: batch.id,
      rowIndex: i,
      item: params.items[i],
      file: params.files[i],
      userId: params.actorUserId,
      organizationId: params.organizationId,
    });
    results.push(row);
  }

  const imported = results.filter((r) => r.status === 'IMPORTED').length;
  const skipped = results.filter((r) => r.status === 'SKIPPED').length;
  const errors = results.filter((r) => r.status === 'ERROR').length;
  const finalStatus = errors === params.files.length && imported === 0 ? 'FAILED' : 'COMPLETED';

  await updateImportBatch(params.organizationId, batch.id, {
    status: finalStatus,
    imported,
    skipped,
    errors,
    finishedAt: new Date(),
  });

  await createAuditRecord({
    title: 'Batch de importación de oficios',
    description: `${imported} importados, ${skipped} omitidos, ${errors} errores de ${params.files.length} archivos`,
    module: 'OFICIOS',
    category: 'CREATE',
    userId: params.actorUserId,
    entityId: batch.id,
    organizationId: params.organizationId,
    newData: {
      batchId: batch.id,
      imported,
      skipped,
      errors,
      total: params.files.length,
    },
  });

  return {
    batchId: batch.id,
    total: params.files.length,
    imported,
    skipped,
    errors,
    results,
  };
}

export function parseImportBatchPayload(raw: unknown): { items: BatchItemPayload[]; notes?: string } {
  if (typeof raw !== 'string') {
    throw new OficioBadRequestError('Falta payload del batch');
  }
  try {
    return JSON.parse(raw) as { items: BatchItemPayload[]; notes?: string };
  } catch {
    throw new OficioBadRequestError('Payload JSON inválido');
  }
}
