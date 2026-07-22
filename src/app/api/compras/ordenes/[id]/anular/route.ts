import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { anularCompraOrden, getCompraOrden } from '@/lib/compras/orden/service';
import { anularOrdenSchema } from '@/lib/compras/orden/schemas';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';

export const POST = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const { id } = await params;
  const existing = await getCompraOrden(id);
  if (!existing) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!canOrdenAction(role, 'anular', { isCreator: existing.createdById === req.user!.userId, status: existing.status })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = anularOrdenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const orden = await anularCompraOrden(id, req.user!.userId, parsed.data.cancellationReason);
    return NextResponse.json({ orden });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 400 });
  }
});
