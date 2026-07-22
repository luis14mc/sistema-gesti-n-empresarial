import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import {
  generateAssetCode,
  resolveEquipmentCategory,
  CATEGORY_LABELS,
} from '@/lib/equipment-asset-code';
import { logEquipmentHistory } from '@/lib/equipment-history';
import { mapEquipmentResponse } from '@/lib/equipment-mapper';
import { isOrganizationContextError, requireOrganizationContext } from '@/modules/organizations/application/context';
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
    const organization = await requireOrganizationContext(req, requestId);
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
    const organization = await requireOrganizationContext(req, requestId);
    const body = await req.json();
    const {
      type,
      category,
      brand,
      model,
      serialNumber,
      inventoryCode,
      assetCode,
      purchaseDate,
      purchaseOrder,
      supplier,
      warrantyDate,
      cost,
      ram,
      processor,
      storage,
      os,
      ipAddress,
      macAddress,
      location,
      notes,
    } = body;

    if (!brand || !model) {
      return NextResponse.json({ error: 'Marca y modelo son requeridos' }, { status: 400 });
    }

    const resolvedCategory = resolveEquipmentCategory(category, type);
    const code = inventoryCode || assetCode || (await generateAssetCode(resolvedCategory));
    const displayType = type || CATEGORY_LABELS[resolvedCategory];

    const equipment = await prisma.equipment.create({
      data: {
        inventoryCode: code,
        organizationId: organization.organizationId,
        category: resolvedCategory,
        type: displayType,
        brand,
        model,
        serialNumber: serialNumber || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchaseOrder,
        supplier,
        warrantyDate: warrantyDate ? new Date(warrantyDate) : null,
        cost: cost ?? null,
        ram,
        processor,
        storage,
        os,
        ipAddress,
        macAddress,
        location,
        notes,
      },
    });

    await logEquipmentHistory({
      equipmentId: equipment.id,
      action: 'CREATED',
      title: 'Equipo registrado',
      description: `Activo ${code} (${brand} ${model}) registrado en inventario.`,
      newData: { inventoryCode: code, category: resolvedCategory, brand, model },
      performedById: req.user!.userId,
    });

    await createAuditRecord({
      title: 'Creación de equipo',
      description: `Se creó equipo: ${code} (${brand} ${model})`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: equipment.id,
      entityType: 'Equipment',
      organizationId: organization.organizationId,
      action: 'EQUIPMENT_CREATED',
      newData: { inventoryCode: code, category: resolvedCategory, brand, model },
    });

    return NextResponse.json({ equipment: mapEquipmentResponse(equipment) }, { status: 201 });
  } catch (error) {
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
export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
