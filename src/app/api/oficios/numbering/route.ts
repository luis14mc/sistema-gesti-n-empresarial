import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import {
  ensureDefaultNumberingConfigs,
  listNumberingConfigs,
  serializeNumberingConfig,
  upsertNumberingConfig,
} from '@/modules/oficios/application/numbering-config';
import { OficioNumberingError } from '@/modules/oficios/infrastructure/numbering';
import { previewNextNumber, validateNomenclaturePattern } from '@/lib/oficios-numbering';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.configure');
    await ensureDefaultNumberingConfigs(
      prisma,
      organization.organizationId,
      req.user!.userId,
    );
    const configs = await listNumberingConfigs(prisma, organization.organizationId);
    return NextResponse.json({
      configs: configs.map(serializeNumberingConfig),
    });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    console.error('Error listing numbering configs:', error);
    return NextResponse.json({ error: 'Error al listar numeración' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.configure');
    const body = await req.json();

    const existing = await prisma.oficioNumberingConfig.findUnique({
      where: {
        organizationId_dependency_year: {
          organizationId: organization.organizationId,
          dependency: String(body.dependency ?? '').toUpperCase(),
          year: Number(body.year),
        },
      },
    });

    const requestedSequence = Number(body.lastGeneratedSequence ?? 0);
    const elevatedRoles = new Set(['ADMIN', 'OWNER']);
    const isElevatedAdmin = elevatedRoles.has(organization.role);
    const forceRequested = Boolean(body.forceSequenceCorrection);

    if (forceRequested && !isElevatedAdmin) {
      return NextResponse.json(
        {
          error:
            'Solo un administrador puede realizar una corrección elevada del correlativo.',
          code: 'SEQUENCE_CORRECTION_FORBIDDEN',
        },
        { status: 403 },
      );
    }

    if (forceRequested && !String(body.reason ?? '').trim()) {
      return NextResponse.json(
        {
          error: 'Debe indicar el motivo de la corrección elevada del correlativo.',
          code: 'SEQUENCE_CORRECTION_REASON_REQUIRED',
        },
        { status: 400 },
      );
    }

    const config = await upsertNumberingConfig(
      prisma,
      organization.organizationId,
      req.user!.userId,
      {
        dependency: body.dependency,
        year: Number(body.year),
        nomenclaturePattern: String(body.nomenclaturePattern ?? ''),
        lastGeneratedSequence: requestedSequence,
        prefix: body.prefix,
        sequencePadding: body.sequencePadding,
        notes: body.notes,
        isActive: body.isActive !== false,
        allowSequenceCorrection: forceRequested && isElevatedAdmin,
        reason: body.reason,
      },
    );

    const sequenceChanged =
      existing != null && existing.lastGeneratedSequence !== config.lastGeneratedSequence;
    const wasCorrection =
      forceRequested &&
      existing != null &&
      config.lastGeneratedSequence < existing.lastGeneratedSequence;

    await createAuditRecord({
      title: wasCorrection
        ? 'Corrección elevada de correlativo de oficios'
        : existing
          ? 'Numeración de oficios actualizada'
          : 'Numeración de oficios creada',
      description: `${config.dependency} / ${config.year}: ${config.nomenclaturePattern}`,
      module: 'OFICIOS',
      category: existing ? 'UPDATE' : 'CREATE',
      userId: req.user!.userId,
      entityId: config.id,
      organizationId: organization.organizationId,
      previousData: existing
        ? {
            nomenclaturePattern: existing.nomenclaturePattern,
            lastGeneratedSequence: existing.lastGeneratedSequence,
            year: existing.year,
            isActive: existing.isActive,
          }
        : undefined,
      newData: {
        nomenclaturePattern: config.nomenclaturePattern,
        lastGeneratedSequence: config.lastGeneratedSequence,
        year: config.year,
        isActive: config.isActive,
        reason: body.reason ?? null,
        forceSequenceCorrection: wasCorrection,
        sequenceAdjusted: sequenceChanged,
      },
    });

    return NextResponse.json(
      { config: serializeNumberingConfig(config) },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    if (error instanceof OficioNumberingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('Error saving numbering config:', error);
    return NextResponse.json({ error: 'Error al guardar numeración' }, { status: 500 });
  }
}

/** Live pattern preview (no persistence). Requires configure OR create so ops can see next number. */
async function putHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    // Preview for operators during create: allow create OR configure
    try {
      await authorizeOrganization(req, requestId, 'oficios.configure');
    } catch {
      await authorizeOrganization(req, requestId, 'oficios.create');
    }

    const body = await req.json();
    const pattern = String(body.nomenclaturePattern ?? '');
    const validation = validateNomenclaturePattern(pattern);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error, valid: false }, { status: 400 });
    }

    const nextNumber = previewNextNumber({
      pattern,
      lastGeneratedSequence: Number(body.lastGeneratedSequence ?? 0),
      year: Number(body.year ?? new Date().getFullYear()),
      prefix: body.prefix,
      sequencePadding: body.sequencePadding,
    });

    return NextResponse.json({ valid: true, nextNumber });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    return NextResponse.json({ error: 'Error al previsualizar' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
export const PUT = withAuth(putHandler);
