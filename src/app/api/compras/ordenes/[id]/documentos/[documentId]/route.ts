import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { deletePurchaseOrderDocument, getCompraOrden } from '@/lib/compras/orden/service';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';

export const DELETE = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const { id, documentId } = await params;
  const orden = await getCompraOrden(id);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!canOrdenAction(role, 'documentos', { isCreator: orden.createdById === req.user!.userId })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  try {
    await deletePurchaseOrderDocument(id, documentId, req.user!.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
});
