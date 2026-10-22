import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { purchaseOrderTemplateSchema } from '@/modules/purchases/presentation/purchase-order-schemas';
import {
  ensureDefaultTemplate,
  findActivePurchaseOrderTemplateForOrganization,
  savePurchaseOrderTemplate,
} from '@/modules/purchases/application/purchase-order-template';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { loadEffectivePermissions } from '@/modules/purchases/presentation/purchase-order-effective-permissions';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');
  const permissions = await loadEffectivePermissions(org);
  if (!canOrdenAction(permissions, 'read', { membershipRole: org.role })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  await ensureDefaultTemplate(org.organizationId, req.user!.userId);
  const template = await findActivePurchaseOrderTemplateForOrganization(org.organizationId);
  return NextResponse.json({ template });
});

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.update');
  const permissions = await loadEffectivePermissions(org);
  if (!canOrdenAction(permissions, 'template', { membershipRole: org.role })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const body = await req.json();
  const parsed = purchaseOrderTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const template = await savePurchaseOrderTemplate(parsed.data, req.user!.userId, org.organizationId);
  return NextResponse.json({ template });
});
