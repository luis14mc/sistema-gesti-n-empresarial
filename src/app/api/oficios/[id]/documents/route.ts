import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { saveOficioDocument } from '@/lib/oficios-storage';
import { createAuditRecord } from '@/lib/audit';
import type { Role } from '@/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function postHandler(req: AuthenticatedRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const role = req.user!.role as Role;
    if (!canAccess(role, 'oficios', 'create')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const oficio = await prisma.oficio.findUnique({ where: { id }, select: { id: true, createdById: true } });
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const stored = await saveOficioDocument(file);

    const document = await prisma.oficioDocument.create({
      data: {
        oficioId: id,
        filename: stored.filename,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        storageKey: stored.filename,
        url: stored.url,
        fileHash,
        documentType,
        isPrimary,
        uploadedById: req.user!.userId,
      },
    });

    if (isPrimary) {
      await prisma.oficioDocument.updateMany({
        where: { oficioId: id, NOT: { id: document.id } },
        data: { isPrimary: false },
      });
    }

    await prisma.oficioTracking.create({
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
      newData: { documentId: document.id, documentType },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/oficios/[id]/documents:', error);
    if (error instanceof Error && error.message.includes('Formato no permitido')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al subir documento' }, { status: 500 });
  }
}

export const POST = withAuth(postHandler);
