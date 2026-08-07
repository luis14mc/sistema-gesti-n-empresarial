import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createPurchaseOrderSchema, normalizePurchaseOrderPayload } from '@/lib/compras/orden/schemas';
import { buildPurchaseOrderPreviewHtml } from '@/lib/compras/orden/service';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const role = req.user!.role as Role;
  const { organizationId } = await requireOrganizationContext(req);
  if (!canOrdenAction(role, 'read')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const body = normalizePurchaseOrderPayload(await req.json());
  const parsed = createPurchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const html = await buildPurchaseOrderPreviewHtml(parsed.data, organizationId);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar vista previa' },
      { status: 500 }
    );
  }
});
