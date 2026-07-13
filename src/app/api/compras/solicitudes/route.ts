import { NextResponse } from 'next/server';
import type { CompraEstado, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';
import { compraInclude, createCompraSolicitud } from '@/lib/compras/service';
import { createCompraSolicitudSchema } from '@/lib/compras/schemas';
import { logCompraAudit } from '@/lib/compras/audit';
import { COMPRA_AUDIT } from '@/lib/compras/audit-actions';
import { resolveDocumentoEstadoFromDocs } from '@/lib/compras/document-metadata';
import {
  generarPdfSolicitudCompra,
  solicitudTieneErrorDocumento,
  toDocumentoResponse,
} from '@/services/compras-pdf.service';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado') as CompraEstado | null;
    const prioridad = searchParams.get('prioridad');
    const tipoCompra = searchParams.get('tipoCompra');
    const departamentoId = searchParams.get('departamentoId');
    const centroCostoId = searchParams.get('centroCostoId');
    const proveedorId = searchParams.get('proveedorId');
    const search = searchParams.get('search');
    const mine = searchParams.get('mine') === 'true';
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Number.parseInt(searchParams.get('pageSize') || '10', 10);
    const skip = (page - 1) * pageSize;

    const where: Prisma.CompraSolicitudWhereInput = { deletedAt: null };
    if (estado) where.estado = estado;
    if (prioridad) where.prioridad = prioridad as Prisma.EnumCompraPrioridadFilter['equals'];
    if (tipoCompra) where.tipoCompra = tipoCompra as Prisma.EnumCompraTipoFilter['equals'];
    if (departamentoId) where.departamentoSolicitanteId = departamentoId;
    if (centroCostoId) where.centroCostoId = centroCostoId;
    if (proveedorId) where.proveedorId = proveedorId;
    if (mine) where.solicitadoPorId = req.user!.userId;

    if (search) {
      where.OR = [
        { codigoSolicitud: { contains: search, mode: 'insensitive' } },
        { justificacionCompra: { contains: search, mode: 'insensitive' } },
        { proveedor: { nombreRazonSocial: { contains: search, mode: 'insensitive' } } },
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

    const solicitudesConDocumento = await Promise.all(
      solicitudes.map(async (solicitud) => {
        const hasError = await solicitudTieneErrorDocumento(solicitud.id);
        return {
          ...solicitud,
          documentoEstado: resolveDocumentoEstadoFromDocs(solicitud.documentos, hasError),
        };
      })
    );

    return NextResponse.json({
      solicitudes: solicitudesConDocumento,
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
    const parsed = createCompraSolicitudSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }

    const solicitud = await createCompraSolicitud(parsed.data, req.user!.userId, role);

    await logCompraAudit({
      userId: req.user!.userId,
      solicitudId: solicitud.id,
      action: COMPRA_AUDIT.SOLICITUD_CREADA,
      estadoNuevo: solicitud.estado,
      newData: solicitud,
    });

    let documento = null;
    let warning: string | undefined;

    try {
      const generated = await generarPdfSolicitudCompra(solicitud.id, req.user!.userId, {
        auditAction: COMPRA_AUDIT.DOCUMENTO_GENERADO,
      });
      documento = toDocumentoResponse(generated, solicitud.id);
    } catch (pdfError) {
      console.error('Error generating compra PDF on create:', pdfError);
      warning = 'La solicitud fue creada, pero no se pudo generar el PDF.';
      await logCompraAudit({
        userId: req.user!.userId,
        solicitudId: solicitud.id,
        action: COMPRA_AUDIT.DOCUMENTO_ERROR,
        detalles: pdfError instanceof Error ? pdfError.message : 'Error desconocido',
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: { solicitud, documento },
        ...(warning ? { warning } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating compra solicitud:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear solicitud' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
