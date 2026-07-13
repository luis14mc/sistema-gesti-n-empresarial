import { NextResponse } from 'next/server';
import type { CompraEstado, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import {
  applyWorkflowAction,
  compraInclude,
  createCompraSolicitud,
  updateCompraSolicitud,
} from '@/lib/compras/service';
import { borradorCompraSolicitudSchema } from '@/lib/compras/schemas';
import { logCompraAudit } from '@/lib/compras/audit';
import { COMPRA_AUDIT } from '@/lib/compras/audit-actions';
import type { Role } from '@/types';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado') as CompraEstado | null;
    const prioridad = searchParams.get('prioridad');
    const tipo = searchParams.get('tipo');
    const departamentoId = searchParams.get('departamentoId');
    const search = searchParams.get('search');
    const mine = searchParams.get('mine') === 'true';
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') || '10', 10);
    const skip = (page - 1) * pageSize;

    const where: Prisma.CompraSolicitudWhereInput = {
      deletedAt: null,
    };
    if (estado) where.estado = estado;
    if (prioridad) where.prioridad = prioridad as typeof where.prioridad;
    if (tipo) where.tipoCompra = tipo as typeof where.tipoCompra;
    if (departamentoId) where.departamentoSolicitanteId = departamentoId;
    if (mine) where.solicitadoPorId = req.user!.userId;
    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
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

    return NextResponse.json({
      solicitudes,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error listing compras solicitudes:', error);
    return NextResponse.json({ error: 'Error al listar solicitudes' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'create')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = borradorCompraSolicitudSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const solicitud = await createCompraSolicitud(
      parsed.data,
      req.user!.userId,
      role
    );

    await logCompraAudit({
      userId: req.user!.userId,
      solicitudId: solicitud.id,
      action: COMPRA_AUDIT.SOLICITUD_CREADA,
      estadoNuevo: solicitud.estado,
      newData: { numero: solicitud.numero, estado: solicitud.estado },
    });

    return NextResponse.json({ solicitud }, { status: 201 });
  } catch (error) {
    console.error('Error creating compra solicitud:', error);
    return NextResponse.json({ error: 'Error al crear solicitud' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
