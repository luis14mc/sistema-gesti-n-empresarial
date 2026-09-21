import { NextResponse } from 'next/server';
import { Prisma, OficioType as PrismaOficioType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import {
  createRateLimiter,
  RATE_LIMIT_RULES,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import {
  normalizeOficioDirection,
  normalizeOficioDocumentKind,
  normalizeOficioScope,
  shouldGenerateOficioNumber,
  type OficioDirection,
  type OficioScope,
} from '@/lib/oficios-numbering';
import { parseOficioAttachments, isOficioAttachmentUrlAllowed } from '@/lib/oficios-attachments';
import { oficioTenantScope, oficioUserAccessScope } from '@/modules/oficios/infrastructure/tenant-scope';
import {
  allocateOficioNumber,
  OficioNumberingError,
  previewOficioNumber,
} from '@/modules/oficios/infrastructure/numbering';
import {
  isSignerCompatibleWithDependency,
  signerDependencyMismatchMessage,
} from '@/modules/oficios/domain/signer-compatibility';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';

/** Rate-limit por usuario para creación de oficios: 30/min. */
const oficioCreateLimiter = createRateLimiter({
  ...RATE_LIMIT_RULES.MUTATION,
  max: 30,
});

function buildScopeWhere(scope: OficioScope, direction?: OficioDirection): Prisma.OficioWhereInput {
  if (scope === 'INTERNO') {
    return {
      OR: [{ type: 'INTERNAL_MEMO' }, { scope: 'INTERNO' }],
    };
  }

  const base: Prisma.OficioWhereInput = { scope };
  if (direction === 'INCOMING') return { ...base, type: 'INCOMING' };
  if (direction === 'OUTGOING') return { ...base, type: 'OUTGOING' };
  return {
    OR: [
      { scope, type: { in: ['INCOMING', 'OUTGOING'] } },
      // Legacy rows before scope was reliably persisted
      ...(scope === 'DESPACHO'
        ? [{ type: 'OUTGOING' as const, number: { startsWith: 'DPICP-' } }]
        : [{ type: 'OUTGOING' as const, number: { contains: '-CNI-' } }, { type: 'OUTGOING' as const, number: { startsWith: 'CNI-' } }]),
    ],
  };
}

function toPrismaOficioType(direction: OficioDirection): PrismaOficioType {
  return direction as PrismaOficioType;
}

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.read');
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const scopeParam = searchParams.get('scope') ?? searchParams.get('dependency');
    const directionParam = searchParams.get('direction');
    const documentKind = searchParams.get('documentKind');
    const yearParam = searchParams.get('year');
    const search = searchParams.get('search');
    const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1') || 1, 10_000));
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '10') || 10), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.OficioWhereInput = oficioTenantScope(organization.organizationId);
    const andConditions: Prisma.OficioWhereInput[] = [];

    if (req.user!.role === 'USER') {
      andConditions.push(oficioUserAccessScope(req.user!.userId, req.user!.email));
    }

    if (status) where.status = status as Prisma.EnumOficioStatusFilter;
    if (documentKind) where.documentKind = documentKind;

    if (yearParam) {
      const year = Number.parseInt(yearParam, 10);
      if (!Number.isNaN(year)) {
        andConditions.push({
          OR: [
            { sequenceYear: year },
            {
              sequenceYear: null,
              oficioDate: {
                gte: new Date(Date.UTC(year, 0, 1)),
                lt: new Date(Date.UTC(year + 1, 0, 1)),
              },
            },
          ],
        });
      }
    }

    if (scopeParam) {
      const scope = normalizeOficioScope(scopeParam);
      const direction = directionParam
        ? normalizeOficioDirection(directionParam, scope)
        : type
          ? normalizeOficioDirection(type, scope)
          : undefined;
      andConditions.push(buildScopeWhere(scope, direction));
    }

    if ((directionParam || type) && !scopeParam) {
      where.type = toPrismaOficioType(
        normalizeOficioDirection(directionParam ?? type, undefined),
      );
    }

    if (search) {
      andConditions.push({
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { number: { contains: search, mode: 'insensitive' } },
          { recipient: { contains: search, mode: 'insensitive' } },
          { institution: { contains: search, mode: 'insensitive' } },
          { preparedBy: { contains: search, mode: 'insensitive' } },
          { senderName: { contains: search, mode: 'insensitive' } },
          { recipientName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [oficios, total] = await Promise.all([
      prisma.oficio.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          signer: {
            select: { id: true, name: true, positionTitle: true, dependency: true },
          },
          responseTo: {
            select: { id: true, number: true, type: true, subject: true, oficioDate: true, scope: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.oficio.count({ where }),
    ]);

    return NextResponse.json({
      oficios,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    console.error('Error al obtener oficios:', error);
    return NextResponse.json({ error: 'Error al obtener oficios' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.create');

    const rateKey = `${req.user!.userId}:${organization.organizationId}`;
    const limitResult = oficioCreateLimiter.check(rateKey);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes, intente nuevamente en un momento.' },
        { status: 429, headers: rateLimitHeaders(limitResult) },
      );
    }

    const body = await req.json();
    const {
      subject,
      number,
      externalNumber,
      type,
      direction,
      scope,
      origin,
      dependency,
      documentKind,
      recipient,
      institution,
      preparedBy,
      oficioDate,
      receivedDate,
      sentDate,
      attachments,
      comments,
      senderName,
      senderPosition,
      recipientName,
      recipientPosition,
      cc,
      responseToId,
      signerId,
      responsibleEmployeeId,
    } = body;

    const oficioScope = normalizeOficioScope(dependency ?? scope ?? origin);
    const oficioDirection = normalizeOficioDirection(direction ?? type, oficioScope);
    const kind = normalizeOficioDocumentKind(documentKind);
    const incomingNumber = (externalNumber ?? number)?.toString().trim();
    const motivo = subject?.toString().trim();
    const destinatario = (recipientName ?? recipient)?.toString().trim();
    const institucion = institution?.toString().trim();
    const elaboradoPor = preparedBy?.toString().trim();

    if (!motivo || !oficioDate) {
      return NextResponse.json(
        { error: 'Asunto y fecha del documento son requeridos' },
        { status: 400 },
      );
    }

    if (!institucion) {
      return NextResponse.json({ error: 'La institución es obligatoria' }, { status: 400 });
    }

    if (oficioDirection === 'INCOMING' && !incomingNumber) {
      return NextResponse.json(
        { error: 'Los oficios de entrada deben registrar el número original externo' },
        { status: 400 },
      );
    }

    if (oficioDirection !== 'INCOMING' && !destinatario) {
      return NextResponse.json(
        { error: 'El destinatario es obligatorio para salidas' },
        { status: 400 },
      );
    }

    if (!attachments || (Array.isArray(attachments) && attachments.length === 0)) {
      return NextResponse.json(
        { error: 'Es obligatorio adjuntar el documento oficial para crear el oficio' },
        { status: 400 },
      );
    }

    const parsedAttachments = parseOficioAttachments(attachments);
    if (parsedAttachments.length === 0) {
      return NextResponse.json(
        { error: 'El documento adjunto no tiene un formato válido' },
        { status: 400 },
      );
    }

    for (const att of parsedAttachments) {
      if (!isOficioAttachmentUrlAllowed(att.url, organization.organizationId)) {
        return NextResponse.json(
          { error: 'URL de documento adjunto no válida' },
          { status: 400 },
        );
      }
    }

    if (responseToId) {
      const related = await prisma.oficio.findFirst({
        where: { id: responseToId, organizationId: organization.organizationId },
        select: { id: true },
      });
      if (!related) {
        return NextResponse.json(
          { error: 'El documento relacionado no existe en esta organización' },
          { status: 400 },
        );
      }
    }

    if (signerId) {
      const signer = await prisma.oficioSigner.findFirst({
        where: {
          id: signerId,
          organizationId: organization.organizationId,
        },
        select: { id: true, isActive: true, dependency: true },
      });
      if (!signer) {
        return NextResponse.json(
          { error: 'Firmante no válido o no pertenece a esta organización' },
          { status: 400 },
        );
      }
      if (!signer.isActive) {
        return NextResponse.json(
          { error: 'El firmante seleccionado está inactivo' },
          { status: 400 },
        );
      }
      if (!isSignerCompatibleWithDependency(signer.dependency, oficioScope)) {
        return NextResponse.json(
          {
            error: signerDependencyMismatchMessage(
              signer.dependency ?? 'desconocida',
              oficioScope,
            ),
          },
          { status: 400 },
        );
      }
    }

    if (responsibleEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: {
          id: responsibleEmployeeId,
          organizationId: organization.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!employee) {
        return NextResponse.json({ error: 'Empleado responsable no válido' }, { status: 400 });
      }
    }

    const year = new Date(oficioDate).getFullYear();

    const oficio = await prisma.$transaction(async (tx) => {
      let oficioNumber = incomingNumber!;
      let sequenceYear: number | null = null;
      let allocatedSequence: number | null = null;

      if (shouldGenerateOficioNumber(oficioDirection)) {
        const allocated = await allocateOficioNumber(tx, {
          organizationId: organization.organizationId,
          scope: oficioScope,
          direction: oficioDirection,
          year,
        });
        oficioNumber = allocated.documentNumber;
        sequenceYear = allocated.year;
        allocatedSequence = allocated.sequence;
      }

      const created = await tx.oficio.create({
        data: {
          organizationId: organization.organizationId,
          number: oficioNumber,
          subject: motivo,
          scope: oficioScope,
          documentKind: kind,
          recipient: destinatario || (senderName?.toString().trim() ?? null),
          institution: institucion,
          preparedBy: elaboradoPor || null,
          type: toPrismaOficioType(oficioDirection),
          status: oficioDirection === 'INCOMING' ? 'RECEIVED' : 'DRAFT',
          oficioDate: new Date(oficioDate),
          receivedDate: receivedDate
            ? new Date(receivedDate)
            : oficioDirection === 'INCOMING'
              ? new Date()
              : undefined,
          sentDate: sentDate
            ? new Date(sentDate)
            : oficioDirection === 'OUTGOING'
              ? undefined
              : undefined,
          sequenceYear,
          senderName: senderName?.toString().trim() || null,
          senderPosition: senderPosition?.toString().trim() || null,
          recipientName: (recipientName ?? destinatario)?.toString().trim() || null,
          recipientPosition: recipientPosition?.toString().trim() || null,
          cc: cc?.toString().trim() || null,
          comments: comments?.toString().trim() || null,
          responseToId: responseToId || null,
          signerId: signerId || null,
          responsibleEmployeeId: responsibleEmployeeId || null,
          attachments: parsedAttachments as unknown as Prisma.InputJsonValue,
          createdById: req.user!.userId,
          updatedById: req.user!.userId,
        } as Prisma.OficioUncheckedCreateInput,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          signer: {
            select: { id: true, name: true, positionTitle: true, dependency: true },
          },
          responseTo: {
            select: { id: true, number: true, type: true, subject: true, oficioDate: true, scope: true },
          },
        },
      });

      await tx.oficioTracking.create({
        data: {
          oficioId: created.id,
          action: 'CREATED',
          title: oficioDirection === 'INCOMING' ? 'Correspondencia de entrada registrada' : 'Correspondencia de salida creada',
          description: `Documento ${created.number}`,
          performedById: req.user!.userId,
          newData: {
            number: created.number,
            direction: oficioDirection,
            dependency: oficioScope,
            documentKind: kind,
            sequence: allocatedSequence,
          },
        },
      });

      if (allocatedSequence != null) {
        await tx.oficioTracking.create({
          data: {
            oficioId: created.id,
            action: 'NUMBER_GENERATED',
            title: 'Número de oficio generado',
            description: created.number,
            performedById: req.user!.userId,
            newData: { number: created.number, sequence: allocatedSequence, year: sequenceYear },
          },
        });
      }

      if (responseToId) {
        await tx.oficioTracking.create({
          data: {
            oficioId: created.id,
            action: 'RELATIONSHIP_LINKED',
            title: 'Documento relacionado',
            description: `Vinculado como respuesta/relación`,
            performedById: req.user!.userId,
            newData: { responseToId },
          },
        });
      }

      return created;
    });

    await createAuditRecord({
      title: 'Creación de correspondencia',
      description: `Se creó oficio: ${oficio.number} - ${subject}`,
      module: 'OFICIOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: oficio.id,
      organizationId: organization.organizationId,
      newData: {
        number: oficio.number,
        subject,
        scope: oficioScope,
        direction: oficioDirection,
        documentKind: kind,
        responseToId: responseToId || null,
      },
    });

    return NextResponse.json({ oficio }, { status: 201 });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    if (error instanceof OficioNumberingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('Error al crear oficio:', error);
    return NextResponse.json({ error: 'Error al crear oficio' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);

/** Exported for preview endpoint reuse */
export { previewOficioNumber };
