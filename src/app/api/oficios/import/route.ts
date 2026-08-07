import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { saveOficioDocument } from '@/lib/oficios-storage';
import { createAuditRecord } from '@/lib/audit';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import { oficioDocumentTenantScope, oficioTenantScope } from '@/modules/oficios/infrastructure/tenant-scope';

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
  const requestId = crypto.randomUUID();
  try {
    const organization = await requireOrganizationContext(req, requestId);
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
      organizationId: organization.organizationId,
      number: payload.number,
      institution: payload.institution,
      oficioDate: payload.oficioDate,
      originalName: file.name,
      fileHash,
    });

    if (duplicates.hard.length > 0) {
      return NextResponse.json(
        {
          error: 'DUPLICATE_FILE_CONTENT',
          message: `El archivo ya fue importado previamente en el oficio ${duplicates.hard[0].number}. Use ?force=true para importar de todas formas.`,
          duplicates: duplicates.hard,
        },
        { status: 409 }
      );
    }

    const force = req.nextUrl.searchParams.get('force') === 'true';
    if (duplicates.soft.length > 0 && !force) {
      return NextResponse.json(
        {
          error: 'POSSIBLE_DUPLICATE',
          message: 'Se detectaron posibles duplicados por número/institución/fecha. Use ?force=true para confirmar.',
          duplicates: duplicates.soft,
               warnings: duplicates.soft.map((d) => d.reason),
        },
        { status: 409 }
      );
    }

    const stored = await saveOficioDocument(file, organization.organizationId);

    const oficio = await prisma.oficio.create({
      data: {
        organizationId: organization.organizationId,
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
            storageKey: stored.storageKey,
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
      } as Prisma.OficioUncheckedCreateInput,
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
      organizationId: organization.organizationId,
      newData: { number: oficio.number, fileHash, originalName: file.name },
    });

    return NextResponse.json(
      { oficio, duplicates: duplicates.soft, warnings: duplicates.soft.map((d) => d.reason) },
      { status: 201 },
    );
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
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

export interface DuplicateMatch {
  id: string;
  number: string;
  reason: string;
  field: 'number' | 'institution+date' | 'fileHash' | 'originalName';
}

export interface DuplicateResult {
  /** Coincidencias duras: bloquean la importación salvo ?force=true. */
  hard: DuplicateMatch[];
  /** Coincidencias blandas: warning; el import continúa. */
  soft: DuplicateMatch[];
}

/**
 * Detecta posibles duplicados al importar un oficio.
 *
 * Reglas:
 * - `fileHash` idéntico → DURO (mismo contenido binario, casi siempre es reimport).
 * - `number` idéntico → BLANDO (puede ser reasignación legítima).
 * - `institution + oficioDate` idénticos → BLANDO (heurística).
 * - `originalName` idéntico → BLANDO (heurística).
 */
async function findDuplicates(params: {
  organizationId: string;
  number: string;
  institution?: string | null;
  oficioDate: string;
  originalName: string;
  fileHash: string;
}): Promise<DuplicateResult> {
  const hard: DuplicateMatch[] = [];
  const soft: DuplicateMatch[] = [];
  const seen = new Set<string>();

  const sameNumber = await prisma.oficio.findFirst({
    where: { ...oficioTenantScope(params.organizationId), number: { equals: params.number, mode: 'insensitive' } },
    select: { id: true, number: true, institution: true },
  });
  if (sameNumber) {
    soft.push({
      id: sameNumber.id,
      number: sameNumber.number,
      reason: `Mismo número: ${sameNumber.number}`,
      field: 'number',
    });
    seen.add(sameNumber.id);
  }

  let sameInst: { id: string; number: string } | null = null;
  if (params.institution) {
    sameInst = await prisma.oficio.findFirst({
      where: {
        ...oficioTenantScope(params.organizationId),
        institution: { equals: params.institution, mode: 'insensitive' },
        oficioDate: new Date(params.oficioDate),
      },
      select: { id: true, number: true, institution: true },
    });
    if (sameInst && !seen.has(sameInst.id)) {
      soft.push({
        id: sameInst.id,
        number: sameInst.number,
        reason: `Misma institución y fecha: ${sameInst.number}`,
        field: 'institution+date',
      });
      seen.add(sameInst.id);
    }
  }

  const sameHash = await prisma.oficioDocument.findFirst({
    where: { ...oficioDocumentTenantScope(params.organizationId), fileHash: params.fileHash },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameHash && !seen.has(sameHash.oficioId)) {
    hard.push({
      id: sameHash.oficioId,
      number: sameHash.oficio.number,
      reason: `Mismo contenido de archivo en oficio ${sameHash.oficio.number}`,
      field: 'fileHash',
    });
    seen.add(sameHash.oficioId);
  }

  const sameName = await prisma.oficioDocument.findFirst({
    where: {
      oficio: oficioTenantScope(params.organizationId),
      originalName: { equals: params.originalName, mode: 'insensitive' },
    },
    select: { oficioId: true, oficio: { select: { number: true } } },
  });
  if (sameName && !seen.has(sameName.oficioId)) {
    soft.push({
      id: sameName.oficioId,
      number: sameName.oficio.number,
      reason: `Mismo nombre de archivo en oficio ${sameName.oficio.number}`,
      field: 'originalName',
    });
    seen.add(sameName.oficioId);
  }

  return { hard, soft };
}

export const POST = withAuth(postHandler);
