import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { Prisma } from '@prisma/client';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    const where: Prisma.EquipmentWhereInput = {};
    const andConditions: Prisma.EquipmentWhereInput[] = [];

    // RBAC: Prevención de IDOR para rol USER - solo ve equipos asignados a él
    if (req.user!.role === 'USER') {
      andConditions.push({
        assignments: {
          some: {
            userId: req.user!.userId,
            status: 'ACTIVE'
          }
        }
      });
    } else {
      if (status) where.status = status as any;
      if (type) where.type = type as any;
    }

    if (search) {
      andConditions.push({
        OR: [
          { inventoryCode: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
        ]
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { inventoryCode: 'asc' },
      }),
      prisma.equipment.count({ where })
    ]);

    return NextResponse.json({
      equipment,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    return NextResponse.json(
      { error: 'Error al obtener equipos' },
      { status: 500 }
    );
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const {
      type,
      brand,
      model,
      serialNumber,
      inventoryCode,
      purchaseDate,
      ram,
      processor,
      storage,
      os,
    } = await req.json();

    if (!type || !brand || !model || !serialNumber) {
      return NextResponse.json(
        { error: 'Tipo, marca, modelo y número de serie son requeridos' },
        { status: 400 }
      );
    }

    const code = inventoryCode || `CNI-${Date.now().toString(36).toUpperCase()}`;

    const equipment = await prisma.equipment.create({
      data: {
        inventoryCode: code,
        type,
        brand,
        model,
        serialNumber,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        ram,
        processor,
        storage,
        os,
      },
    });

    await createAuditRecord({
      title: 'Creación de equipo',
      description: `Se creó equipo: ${code} (${brand} ${model})`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: equipment.id,
      newData: { inventoryCode: code, type, brand, model },
    });

    return NextResponse.json({ equipment }, { status: 201 });
  } catch (error) {
    console.error('Error al crear equipo:', error);
    return NextResponse.json(
      { error: 'Error al crear equipo' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
