import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { saveOficioDocument } from '@/lib/oficios-storage';
import { createAuditRecord } from '@/lib/audit';
import type { Role } from '@/types';

export const dynamic = 'force-dynamic';

interface ImportPayload {
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

async function postHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'oficios', 'create')) {
      return NextResponse.json({ error: 'Sin permisos para importar oficios' }, { status: 403 });
    }

    const formData = await req.formData();
    const payloadRaw = formData.get('payload');
    if (typeof payloadRaw !== 'string') {
      return NextResponse.json({ error: 'Falta el payload del oficio' }, { status: 400 });
    }

    let payload: ImportPayload;
    try {
      payload = JSON.parse(payloadRaw) as ImportPayload;
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const validationErrors = validatePayload(payload);
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: validationErrors.join('; ') }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    const duplicates = await findDuplicates({
      number: payload.number,
      institution: payload.institution,
      oficioDate: payload.oficioDate,
      originalName: file.name,
      fileHash,
    });

    const stored = await saveOficioDocument(file);

    const oficio = await prisma.oficio.create({
      data: {
        number: payload.number.trim(),
        type: payload.type ?? 'INCOMING',
        scope: payload.scope ?? null,
        subject: payload.motivo.trim(),
        recipient: payload.recipient?.trim() || null,
        institution: payload.institution?.trim() || null,
        preparedBy: payload.preparedBy?.trim() || null,
        status: payload.status ?? 'RECEIVED',
        oficioDate: new Date(payload.oficioDate),
        receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : new Date(),
        recordSource: 'HISTORICAL_IMPORT',
        importedById: req.user!.userId,
        importedAt: new Date(),
        comments: payload.comments?.trim() || null,
        createdById: req.user!.userId,
        documents: {
          create: {
            filename: stored.filename,
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            size: stored.size,
            storageKey: stored.filename,
            url: stored.url,
            fileHash,
            documentType: payload.documentType ?? 'OFICIO_PRINCIPAL',
            isPrimary: true,
            uploadedById: req.user!.userId,
          },
        },
        tracking: {
          create: {
            action: 'IMPORTED',
            title: 'Oficio importado (histórico)',
            description: `Importado por ${req.user!.email}`,
            performedById: req.user!.userId,
            newData: {
              number: payload.number,
              fileHash,
              originalName: file.name,
            },
          },
        },
      },
      include: {
        documents: true,
        tracking: { orderBy: { createdAt: 'desc' } },
      },
    });

    await createAuditRecord({
      title: 'Importación de oficio histórico',
      description: `Se importó oficio ${oficio.number} desde archivo ${file.name}`,
      module: 'OFICIOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: oficio.id,
      newData: { number: oficio.number, fileHash, originalName: file.name },
    });

    return NextResponse.json(
      { oficio, duplicates, warnings: duplicates.length > 0 ? ['Se detectaron posibles duplicados'] : [] },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error en /api/oficios/import:', error);
    if (error instanceof Error && error.message.includes('Formato no permitido')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al importar oficio' }, { status: 500 });
  }
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

async function findDuplicates(params: {
  number: string;
  institution?: string | null;
  oficioDate: string;
  originalName: string;
  fileHash: string;
}): Promise<Array<{ id: string; number: string; reason: string }>> {
  const reasons: Array<{ field: string; reason: string }> = [];

  const sameNumber = await prisma.oficio.findFirst({
    where: { number: { equals: params.number, mode: 'insensitive' } },
    select: { id: true, number: true, institution: true },
  });
  if (sameNumber) reasons.push({ field: 'number', reason: `Mismo número: ${sameNumber.number}` });

  if (params.institution) {
    const sameInst = await prisma.oficio.findFirst({
      where: {
        institution: { equals: params.institution, mode: 'insensitive' },
        oficioDate: new Date(params.oficioDate),
      },
      select: { id: true, number: true, institution: true },
    });
    if (sameInst) reasons.push({ field: 'institution+date', reason: `Misma institución y fecha: ${sameInst.number}` });
  }

  const sameHash = await prisma.oficioDocument.findFirst({
    where: { fileHash: params.fileHash },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameHash) reasons.push({ field: 'fileHash', reason: `Mismo archivo en oficio ${sameHash.oficio.number}` });

  const sameName = await prisma.oficioDocument.findFirst({
    where: { originalName: { equals: params.originalName, mode: 'insensitive' } },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameName) reasons.push({ field: 'originalName', reason: `Mismo nombre de archivo en oficio ${sameName.oficio.number}` });

  const result: Array<{ id: string; number: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const r of reasons) {
    const id = (sameNumber && r.field === 'number' ? sameNumber.id : null)
      ?? (sameHash?.oficioId ?? null)
      ?? (sameName?.oficioId ?? null)
      ?? '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, number: sameNumber?.number ?? sameHash?.oficio.number ?? sameName?.oficio.number ?? '', reason: r.reason });
  }
  return result;
}

export const POST = withAuth(postHandler);
