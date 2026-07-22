import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { regenerarPdfCompraOrden, getCompraOrden } from '@/lib/compras/orden/service';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';

export const POST = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const { id } = await params;
  const existing = await getCompraOrden(id);
  if (!existing) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!canOrdenAction(role, 'regenerar_pdf', { isCreator: existing.createdById === req.user!.userId, status: existing.status })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  try {
    const orden = await regenerarPdfCompraOrden(id, req.user!.userId);
    return NextResponse.json({ orden });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
});
