import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createPurchaseOrderSchema, normalizePurchaseOrderPayload } from '@/modules/purchases/presentation/purchase-order-schemas';
import { buildPurchaseOrderPreviewHtml } from '@/modules/purchases/application/purchase-order-use-cases';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { loadEffectivePermissions } from '@/modules/purchases/presentation/purchase-order-effective-permissions';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');
  const permissions = await loadEffectivePermissions(org);
  if (!canOrdenAction(permissions, 'read', { membershipRole: org.role, sessionRole: req.user!.role })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const body = normalizePurchaseOrderPayload(await req.json());
  const parsed = createPurchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const html = await buildPurchaseOrderPreviewHtml(parsed.data, org.organizationId);
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
