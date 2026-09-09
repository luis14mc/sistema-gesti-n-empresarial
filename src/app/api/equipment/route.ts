import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { Prisma } from '@prisma/client';
import { mapEquipmentResponse } from '@/lib/equipment-mapper';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { createEquipmentRecord } from '@/modules/equipment/import-export/equipment-create';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { equipmentInputSchema } from '@/modules/equipment/import-export/schemas';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { z } from 'zod';

const equipmentListQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function organizationFailure(error: unknown, requestId: string) {
  if (!isOrganizationContextError(error)) return null;
  const message = error.code === 'ORGANIZATION_SELECTION_REQUIRED'
    ? 'Seleccione la organización con la que desea trabajar.'
    : error.code === 'AUTHENTICATION_REQUIRED'
      ? 'Debe iniciar sesión para continuar.'
      : 'No existe una organización activa para este usuario.';
  return apiFailure(error.code, message, { requestId, status: error.status, details: [], stage: 'RESOLVE_ORGANIZATION_CONTEXT' });
}

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'equipment.read');
    const { status, type, category, search, page, pageSize } = equipmentListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const skip = (page - 1) * pageSize;

    const where: Prisma.EquipmentWhereInput = { organizationId: organization.organizationId };
    const andConditions: Prisma.EquipmentWhereInput[] = [];

    if (req.user!.role === 'USER') {
      const employee = await prisma.employee.findFirst({
        where: { userId: req.user!.userId },
      });
      andConditions.push({
        assignments: {
          some: {
            status: 'ACTIVE',
            OR: [
              { userId: req.user!.userId },
              ...(employee ? [{ employeeId: employee.id }] : []),
            ],
          },
        },
      });
    } else {
      if (status) where.status = status as Prisma.EnumEquipmentStatusFilter['equals'];
      if (category) where.category = category as Prisma.EnumEquipmentCategoryFilter['equals'];
      if (type) where.type = type;
    }

    if (search) {
      andConditions.push({
        OR: [
          { inventoryCode: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) where.AND = andConditions;

    const [rows, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { inventoryCode: 'asc' },
      }),
      prisma.equipment.count({ where }),
    ]);

    const equipment = rows.map(mapEquipmentResponse);

    return apiSuccess({
      items: equipment,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    }, { requestId });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    const failure = organizationFailure(error, requestId);
    if (failure) return failure;
    if (error instanceof z.ZodError) {
      return apiFailure('INVALID_EQUIPMENT_QUERY', 'Los filtros de equipos son inválidos.', { requestId, status: 400, details: error.issues, stage: 'VALIDATE_QUERY' });
    }
    console.error('[EQUIPMENT LIST ERROR]', { requestId, error });
    return apiFailure('EQUIPMENT_LIST_FAILED', 'No se pudieron cargar los equipos.', { requestId, status: 500, details: [], stage: 'LIST_EQUIPMENT' });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'equipment.create');
    const body = await req.json();
    const parsed = equipmentInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const equipment = await createEquipmentRecord(parsed.data, {
      organizationId: organization.organizationId,
      userId: req.user!.userId,
      requestId,
    });

    return NextResponse.json({ equipment: mapEquipmentResponse(equipment) }, { status: 201 });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    const failure = organizationFailure(error, requestId);
    if (failure) return failure;
    console.error('Error al crear equipo:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Código de activo o número de serie duplicado' }, { status: 409 });
    }
    return apiFailure('EQUIPMENT_CREATE_FAILED', 'No se pudo crear el equipo.', { requestId, status: 500, details: [], stage: 'CREATE_EQUIPMENT' });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
