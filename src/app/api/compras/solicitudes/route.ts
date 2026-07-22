import { NextResponse } from 'next/server';
import type { CompraEstado, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { compraInclude, createCompraSolicitud } from '@/lib/compras/service';
import { borradorOrdenSchema } from '@/lib/compras/schemas';
import { logCompraAudit } from '@/lib/compras/audit';
import { COMPRA_AUDIT } from '@/lib/compras/audit-actions';
import { deprecatedComprasResponse } from '@/lib/compras/deprecated-response';
import type { Role } from '@/types';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado') as CompraEstado | null;
    const search = searchParams.get('search');
    const mine = searchParams.get('mine') === 'true';
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') || '10', 10);
    const skip = (page - 1) * pageSize;

    const where: Prisma.CompraSolicitudWhereInput = { deletedAt: null };
    if (estado) where.estado = estado;
    if (mine) where.solicitadoPorId = req.user!.userId;
    if (search) {
      where.OR = [
        { numeroOrden: { contains: search, mode: 'insensitive' } },
        { referenciaCompra: { contains: search, mode: 'insensitive' } },
        { proveedorNombre: { contains: search, mode: 'insensitive' } },
        { justificacionCompra: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [solicitudes, total] = await Promise.all([
      prisma.compraSolicitud.findMany({
        where,
        skip,
        take: pageSize,
        include: compraInclude,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.compraSolicitud.count({ where }),
    ]);

    return deprecatedComprasResponse({
      solicitudes,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error listing ordenes:', error);
    return NextResponse.json({ error: 'Error al listar órdenes' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'create')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = borradorOrdenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const solicitud = await createCompraSolicitud(parsed.data, req.user!.userId, role);

    await logCompraAudit({
      userId: req.user!.userId,
      solicitudId: solicitud.id,
      action: COMPRA_AUDIT.SOLICITUD_CREADA,
      estadoNuevo: solicitud.estado,
      newData: { id: solicitud.id, estado: solicitud.estado },
    });

    return deprecatedComprasResponse({ solicitud }, { status: 201 });
  } catch (error) {
    console.error('Error creating orden:', error);
    return NextResponse.json({ error: 'Error al crear orden' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
