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

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    const where: Prisma.EquipmentWhereInput = {};
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

    return NextResponse.json({
      equipment,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    return NextResponse.json({ error: 'Error al obtener equipos' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
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
      newData: { inventoryCode: code, category: resolvedCategory, brand, model },
    });

    return NextResponse.json({ equipment: mapEquipmentResponse(equipment) }, { status: 201 });
  } catch (error) {
    console.error('Error al crear equipo:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Código de activo o número de serie duplicado' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear equipo' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
