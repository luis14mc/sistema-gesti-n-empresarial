import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// GET - Listar items promocionales
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { inventoryCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.promotionalItem.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          movements: {
            orderBy: { movementDate: 'desc' },
            take: 5,
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.promotionalItem.count({ where })
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Error al obtener items:', error);
    return NextResponse.json(
      { error: 'Error al obtener items' },
      { status: 500 }
    );
  }
}

// POST - Crear item promocional
async function postHandler(req: AuthenticatedRequest) {
  try {
    const { name, description, quantity, unitPrice, purchaseDate } = await req.json();

    if (!name || !unitPrice || !purchaseDate) {
      return NextResponse.json(
        { error: 'Nombre, precio unitario y fecha de compra son requeridos' },
        { status: 400 }
      );
    }

    const count = await prisma.promotionalItem.count();
    const inventoryCode = `CNI-Prom-${String(count + 1).padStart(3, '0')}`;

    const item = await prisma.promotionalItem.create({
      data: {
        inventoryCode,
        name,
        description,
        quantity: quantity || 0,
        unitPrice,
        purchaseDate: new Date(purchaseDate),
      },
    });

    await createAuditRecord({
      title: 'Creación de item promocional',
      description: `Se creó item: ${name}`,
      module: 'INVENTARIO',
      category: 'CREATE',
      userId: req.user!.userId,
      entityId: item.id,
      newData: { inventoryCode, name },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error al crear item:', error);
    return NextResponse.json(
      { error: 'Error al crear item' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN']);
