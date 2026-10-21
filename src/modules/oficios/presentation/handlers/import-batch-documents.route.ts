import { createHash } from 'crypto';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { oficiosDb } from '@/modules/oficios/infrastructure/prisma-client';
import { saveOficioDocument } from '@/modules/oficios/infrastructure/oficios-storage';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { oficioBatchScope } from '@/modules/oficios/infrastructure/tenant-scope';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function normalizeMatchKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function numberFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim();
}

async function postHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const { id: batchId } = await context.params;

    const batch = await oficiosDb.oficioImportBatch.findFirst({
      where: oficioBatchScope(organization.organizationId, batchId),
      include: {
        items: {
          where: { status: 'IMPORTED', oficioId: { not: null } },
          select: { oficioId: true, number: true },
        },
      },
    });
    if (!batch) {
      return apiFailure('BATCH_NOT_FOUND', 'Lote no encontrado.', { requestId, status: 404, details: [], stage: 'LOAD_BATCH' });
    }

    const form = await req.formData();
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    const assignmentsRaw = form.get('assignments');
    let manualAssignments: Array<{ fileName: string; oficioId: string }> = [];
    if (typeof assignmentsRaw === 'string' && assignmentsRaw.trim()) {
      manualAssignments = JSON.parse(assignmentsRaw) as Array<{ fileName: string; oficioId: string }>;
    }

    const byNumber = new Map<string, string>();
    for (const item of batch.items) {
      if (item.number && item.oficioId) {
        byNumber.set(normalizeMatchKey(item.number), item.oficioId);
      }
    }

    const matched: Array<{ fileName: string; oficioId: string; documentId: string }> = [];
    const unmatched: string[] = [];

    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        unmatched.push(file.name);
        continue;
      }

      const manual = manualAssignments.find((entry) => entry.fileName === file.name);
      const inferredNumber = numberFromFilename(file.name);
      const oficioId = manual?.oficioId
        ?? byNumber.get(normalizeMatchKey(inferredNumber))
        ?? byNumber.get(normalizeMatchKey(inferredNumber.replace(/_/g, ' ')));

      if (!oficioId) {
        unmatched.push(file.name);
        continue;
      }

      const stored = await saveOficioDocument(file, organization.organizationId);
      const fileHash = stored.fileHash ?? createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');

      const document = await oficiosDb.oficioDocument.create({
        data: {
          oficioId,
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
          fileHash,
          documentType: 'OFICIO_PRINCIPAL',
          isPrimary: true,
          uploadedById: organization.userId,
        },
      });

      await oficiosDb.oficioDocument.updateMany({
        where: { oficioId, NOT: { id: document.id } },
        data: { isPrimary: false },
      });

      matched.push({ fileName: file.name, oficioId, documentId: document.id });
    }

    return apiSuccess({ matched, unmatched }, { requestId });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('[OFICIOS BATCH DOCUMENTS ERROR]', { requestId, error });
    return apiFailure('BATCH_DOCUMENTS_FAILED', 'No se pudieron asociar los PDFs.', { requestId, status: 500, details: [], stage: 'BATCH_DOCUMENTS' });
  }
}

export const POST = withAuth(postHandler);
