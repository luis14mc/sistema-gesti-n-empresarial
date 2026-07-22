import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { saveOficioDocument } from '@/lib/oficios-storage';
import { createAuditRecord } from '@/lib/audit';
import type { Role } from '@/types';

export const dynamic = 'force-dynamic';

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

async function postHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'oficios', 'create')) {
      return NextResponse.json({ error: 'Sin permisos para importar oficios' }, { status: 403 });
    }

    const formData = await req.formData();
    const payloadRaw = formData.get('payload');
    if (typeof payloadRaw !== 'string') {
      return NextResponse.json({ error: 'Falta payload del batch' }, { status: 400 });
    }

    let payload: { items: BatchItemPayload[]; notes?: string };
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return NextResponse.json({ error: 'Batch sin ítems' }, { status: 400 });
    }
    if (payload.items.length > MAX_FILES) {
      return NextResponse.json({ error: `Máximo ${MAX_FILES} archivos por batch` }, { status: 400 });
    }

    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length !== payload.items.length) {
      return NextResponse.json(
        { error: `Cantidad de archivos (${files.length}) no coincide con items (${payload.items.length})` },
        { status: 400 },
      );
    }

    const batch = await prisma.oficioImportBatch.create({
      data: {
        source: 'HISTORICAL_IMPORT',
        status: 'PROCESSING',
        totalFiles: files.length,
        imported: 0,
        skipped: 0,
        errors: 0,
        notes: payload.notes?.trim() || null,
        performedById: req.user!.userId,
      },
    });

    const results: BatchItemResult[] = [];

    for (let i = 0; i < payload.items.length; i++) {
      const item = payload.items[i];
      const file = files[i];
      const rowIndex = i;

      const row = await processItem({
        batchId: batch.id,
        rowIndex,
        item,
        file,
        userId: req.user!.userId,
        userEmail: req.user!.email,
      });
      results.push(row);
    }

    const imported = results.filter((r) => r.status === 'IMPORTED').length;
    const skipped = results.filter((r) => r.status === 'SKIPPED').length;
    const errors = results.filter((r) => r.status === 'ERROR').length;
    const finalStatus = errors === files.length && imported === 0 ? 'FAILED' : 'COMPLETED';

    await prisma.oficioImportBatch.update({
      where: { id: batch.id },
      data: {
        status: finalStatus,
        imported,
        skipped,
        errors,
        finishedAt: new Date(),
      },
    });

    await createAuditRecord({
      title: 'Batch de importación de oficios',
      description: `${imported} importados, ${skipped} omitidos, ${errors} errores de ${files.length} archivos`,
      module: 'OFICIOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: batch.id,
      newData: { batchId: batch.id, imported, skipped, errors, total: files.length },
    });

    return NextResponse.json({
      batchId: batch.id,
      total: files.length,
      imported,
      skipped,
      errors,
      results,
    });
  } catch (error) {
    console.error('Error en /api/oficios/import/batch:', error);
    return NextResponse.json({ error: 'Error al procesar el batch' }, { status: 500 });
  }
}

async function processItem(params: {
  batchId: string;
  rowIndex: number;
  item: BatchItemPayload;
  file: File;
  userId: string;
  userEmail: string;
}): Promise<BatchItemResult> {
  const { batchId, rowIndex, item, file, userId } = params;

  try {
    const validationErrors = validatePayload(item);
    if (validationErrors.length > 0) {
      await prisma.oficioImportBatchItem.create({
        data: {
          batchId, rowIndex, status: 'ERROR',
          originalName: file.name,
          number: item.number,
          institution: item.institution,
          oficioDate: item.oficioDate ? new Date(item.oficioDate) : null,
          errorMessage: validationErrors.join('; '),
        },
      });
      return { rowIndex, fileName: file.name, status: 'ERROR', error: validationErrors.join('; ') };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    const duplicates = await findDuplicates({
      number: item.number,
      institution: item.institution,
      oficioDate: item.oficioDate,
      originalName: file.name,
      fileHash,
    });

    if (duplicates.some((d) => d.field === 'fileHash')) {
      await prisma.oficioImportBatchItem.create({
        data: {
          batchId, rowIndex, status: 'SKIPPED',
          originalName: file.name, number: item.number,
          institution: item.institution,
          oficioDate: item.oficioDate ? new Date(item.oficioDate) : null,
          fileHash, errorMessage: 'Archivo ya importado (hash duplicado)',
        },
      });
      return {
        rowIndex, fileName: file.name, status: 'SKIPPED',
        number: item.number, duplicates: duplicates.map((d) => ({ reason: d.reason })),
        error: 'Archivo ya importado (hash duplicado)',
      };
    }

    const stored = await saveOficioDocument(file);

    const oficio = await prisma.oficio.create({
      data: {
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
            storageKey: stored.filename,
            url: stored.url,
            fileHash,
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
      },
    });

    await prisma.oficioImportBatchItem.create({
      data: {
        batchId, rowIndex, status: 'IMPORTED',
        originalName: file.name, number: item.number,
        institution: item.institution,
        oficioDate: item.oficioDate ? new Date(item.oficioDate) : null,
        fileHash, oficioId: oficio.id,
      },
    });

    return {
      rowIndex, fileName: file.name, status: 'IMPORTED',
      oficioId: oficio.id, number: oficio.number,
      duplicates: duplicates.length > 0 ? duplicates.map((d) => ({ reason: d.reason })) : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    try {
      await prisma.oficioImportBatchItem.create({
        data: {
          batchId, rowIndex, status: 'ERROR',
          originalName: file.name, number: item.number,
          institution: item.institution,
          oficioDate: item.oficioDate ? new Date(item.oficioDate) : null,
          errorMessage: message.slice(0, 500),
        },
      });
    } catch (innerErr) {
      console.error('Error creando item de batch:', innerErr);
    }
    return { rowIndex, fileName: file.name, status: 'ERROR', error: message };
  }
}

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

async function findDuplicates(params: {
  number: string;
  institution?: string | null;
  oficioDate: string;
  originalName: string;
  fileHash: string;
}): Promise<Array<{ field: string; reason: string }>> {
  const results: Array<{ field: string; reason: string }> = [];

  const sameNumber = await prisma.oficio.findFirst({
    where: { number: { equals: params.number, mode: 'insensitive' } },
    select: { id: true, number: true },
  });
  if (sameNumber) results.push({ field: 'number', reason: `Mismo número: ${sameNumber.number}` });

  if (params.institution) {
    const sameInst = await prisma.oficio.findFirst({
      where: {
        institution: { equals: params.institution, mode: 'insensitive' },
        oficioDate: new Date(params.oficioDate),
      },
      select: { id: true, number: true },
    });
    if (sameInst) results.push({ field: 'institution+date', reason: `Misma institución y fecha: ${sameInst.number}` });
  }

  const sameHash = await prisma.oficioDocument.findFirst({
    where: { fileHash: params.fileHash },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameHash) results.push({ field: 'fileHash', reason: `Mismo archivo en oficio ${sameHash.oficio.number}` });

  const sameName = await prisma.oficioDocument.findFirst({
    where: { originalName: { equals: params.originalName, mode: 'insensitive' } },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameName) results.push({ field: 'originalName', reason: `Mismo nombre en oficio ${sameName.oficio.number}` });

  return results;
}

export const POST = withAuth(postHandler);
