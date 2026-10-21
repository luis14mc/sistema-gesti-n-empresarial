import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { oficiosDb } from '@/modules/oficios/infrastructure/prisma-client';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { saveOficioDocument } from '@/modules/oficios/infrastructure/oficios-storage';
import { createAuditRecord } from '@/lib/audit';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { oficioDocumentScope, oficioScope } from '@/modules/oficios/infrastructure/tenant-scope';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function postHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.attachments');
    const { id } = await context.params;

    const oficio = await oficiosDb.oficio.findFirst({ where: oficioScope(organization.organizationId, id), select: { id: true, createdById: true } });
    if (!oficio) {
      return NextResponse.json({ error: 'Oficio no encontrado' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    const documentType = (formData.get('documentType') as string) || 'ANEXO';
    const isPrimary = formData.get('isPrimary') === 'true';

    const stored = await saveOficioDocument(file, organization.organizationId);
    const fileHash = stored.fileHash ?? createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');

    const document = await oficiosDb.oficioDocument.create({
      data: {
        oficioId: id,
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
        documentType,
        isPrimary,
        uploadedById: req.user!.userId,
      },
    });

    if (isPrimary) {
      await oficiosDb.oficioDocument.updateMany({
        where: { ...oficioDocumentScope(organization.organizationId, id), NOT: { id: document.id } },
        data: { isPrimary: false },
      });
    }

    await oficiosDb.oficioTracking.create({
      data: {
        oficioId: id,
        action: 'DOCUMENT_ADDED',
        title: 'Documento agregado',
        description: `${documentType} — ${stored.originalName}`,
        performedById: req.user!.userId,
        newData: { documentId: document.id, documentType, fileHash },
      },
    });

    await createAuditRecord({
      title: 'Documento agregado a oficio',
      description: `Se agregó documento ${stored.originalName} al oficio ${id}`,
      module: 'OFICIOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: id,
      organizationId: organization.organizationId,
      newData: { documentId: document.id, documentType },
    });

    return NextResponse.json(
      { document, pdfOptimizationSummary: stored.pdfOptimizationSummary ?? null },
      { status: 201 },
    );
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    console.error('Error en POST /api/oficios/[id]/documents:', error);
    if (error instanceof Error && error.message.includes('Formato no permitido')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al subir documento' }, { status: 500 });
  }
}

export const POST = withAuth(postHandler);
