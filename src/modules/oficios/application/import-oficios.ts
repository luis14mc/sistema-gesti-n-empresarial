import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { createAuditRecord } from '@/lib/audit';
import { OficioBadRequestError, OficioRequestError } from '@/modules/oficios/domain/errors';
import {
  createHistoricalImportOficio,
  findImportDuplicates,
} from '@/modules/oficios/infrastructure/oficio-import-repository';
import { saveOficioDocument } from '@/modules/oficios/infrastructure/oficios-storage';

export interface ImportPayload {
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

function validatePayload(p: ImportPayload): string[] {
  const errors: string[] = [];
  if (!p.number?.trim()) errors.push('Número de oficio obligatorio');
  if (!p.motivo?.trim()) errors.push('Motivo obligatorio');
  if (!p.oficioDate) errors.push('Fecha original obligatoria');
  if (!p.recipient?.trim()) errors.push('Destinatario obligatorio');
  if (!p.institution?.trim()) errors.push('Institución obligatoria');
  if (!p.preparedBy?.trim()) errors.push('Elaborado por obligatorio');
  return errors;
}

export async function importOficiosUseCase(params: {
  organizationId: string;
  actorUserId: string;
  actorEmail: string;
  payload: ImportPayload;
  file: File;
  force: boolean;
}) {
  const validationErrors = validatePayload(params.payload);
  if (validationErrors.length > 0) {
    throw new OficioBadRequestError(validationErrors.join('; '));
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const fileHash = createHash('sha256').update(buffer).digest('hex');

  const duplicates = await findImportDuplicates({
    organizationId: params.organizationId,
    number: params.payload.number,
    institution: params.payload.institution,
    oficioDate: params.payload.oficioDate,
    originalName: params.file.name,
    fileHash,
  });

  if (duplicates.hard.length > 0) {
    throw new OficioRequestError(
      'DUPLICATE_FILE_CONTENT',
      `El archivo ya fue importado previamente en el oficio ${duplicates.hard[0].number}. Use ?force=true para importar de todas formas.`,
      409,
      {
        error: 'DUPLICATE_FILE_CONTENT',
        message: `El archivo ya fue importado previamente en el oficio ${duplicates.hard[0].number}. Use ?force=true para importar de todas formas.`,
        duplicates: duplicates.hard,
      },
    );
  }

  if (duplicates.soft.length > 0 && !params.force) {
    throw new OficioRequestError(
      'POSSIBLE_DUPLICATE',
      'Se detectaron posibles duplicados por número/institución/fecha. Use ?force=true para confirmar.',
      409,
      {
        error: 'POSSIBLE_DUPLICATE',
        message:
          'Se detectaron posibles duplicados por número/institución/fecha. Use ?force=true para confirmar.',
        duplicates: duplicates.soft,
        warnings: duplicates.soft.map((d) => d.reason),
      },
    );
  }

  const stored = await saveOficioDocument(params.file, params.organizationId);

  const oficio = await createHistoricalImportOficio({
    organizationId: params.organizationId,
    number: params.payload.number.trim(),
    type: params.payload.type ?? 'INCOMING',
    scope: params.payload.scope ?? null,
    subject: params.payload.motivo.trim(),
    recipient: params.payload.recipient?.trim() || null,
    institution: params.payload.institution?.trim() || null,
    preparedBy: params.payload.preparedBy?.trim() || null,
    status: params.payload.status ?? 'RECEIVED',
    oficioDate: new Date(params.payload.oficioDate),
    receivedDate: params.payload.receivedDate
      ? new Date(params.payload.receivedDate)
      : new Date(),
    recordSource: 'HISTORICAL_IMPORT',
    importedById: params.actorUserId,
    importedAt: new Date(),
    comments: params.payload.comments?.trim() || null,
    createdById: params.actorUserId,
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
        documentType: params.payload.documentType ?? 'OFICIO_PRINCIPAL',
        isPrimary: true,
        uploadedById: params.actorUserId,
      },
    },
    tracking: {
      create: {
        action: 'IMPORTED',
        title: 'Oficio importado (histórico)',
        description: `Importado por ${params.actorEmail}`,
        performedById: params.actorUserId,
        newData: {
          number: params.payload.number,
          fileHash,
          originalName: params.file.name,
        },
      },
    },
  } as Prisma.OficioUncheckedCreateInput);

  await createAuditRecord({
    title: 'Importación de oficio histórico',
    description: `Se importó oficio ${oficio.number} desde archivo ${params.file.name}`,
    module: 'OFICIOS',
    category: 'CREATE',
    userId: params.actorUserId,
    entityId: oficio.id,
    organizationId: params.organizationId,
    newData: { number: oficio.number, fileHash, originalName: params.file.name },
  });

  return {
    oficio,
    duplicates: duplicates.soft,
    warnings: duplicates.soft.map((d) => d.reason),
    status: 201 as const,
  };
}

export function parseImportPayload(raw: unknown): ImportPayload {
  if (typeof raw !== 'string') {
    throw new OficioBadRequestError('Falta el payload del oficio');
  }
  try {
    return JSON.parse(raw) as ImportPayload;
  } catch {
    throw new OficioBadRequestError('Payload JSON inválido');
  }
}
