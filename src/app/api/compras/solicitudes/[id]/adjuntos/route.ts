import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';
import { saveCompraDocument } from '@/lib/compras/storage';

type RouteContext = { params: Promise<{ id: string }> };

async function postHandler(req: AuthenticatedRequest, context: RouteContext) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'update')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await context.params;
    const solicitud = await prisma.compraSolicitud.findFirst({ where: { id, deletedAt: null } });
    if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('file');
    const tipoRaw = (formData.get('tipoAdjunto') as string | null)
      ?? (formData.get('tipo') as string | null)
      ?? 'OTRO';
    const TIPOS_VALIDOS = ['COTIZACION', 'FACTURA', 'PROFORMA', 'CORREO_AUTORIZACION', 'SOPORTE_TECNICO', 'OTRO'] as const;
    const tipoAdjunto = (TIPOS_VALIDOS as readonly string[]).includes(tipoRaw)
      ? (tipoRaw as (typeof TIPOS_VALIDOS)[number])
      : 'OTRO';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const stored = await saveCompraDocument(file);
    const adjunto = await prisma.compraAdjunto.create({
      data: {
        solicitudCompraId: id,
        tipoAdjunto,
        nombre: stored.nombre,
        mimeType: stored.mimeType,
        size: stored.size,
        storagePath: stored.storagePath,
        url: stored.url,
        uploadedById: req.user!.userId,
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ adjunto }, { status: 201 });
  } catch (error) {
    console.error('Error uploading compra adjunto:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al subir adjunto' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
