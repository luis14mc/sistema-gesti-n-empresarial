import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { ensureDefaultTemplate, getActiveTemplateConfig } from '@/modules/purchases/infrastructure/purchase-order-template';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { loadEffectivePermissions } from '@/modules/purchases/presentation/purchase-order-effective-permissions';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');
  const permissions = await loadEffectivePermissions(org);
  if (!canOrdenAction(permissions, 'read')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  await ensureDefaultTemplate(org.organizationId, req.user!.userId);
  const template = await getActiveTemplateConfig(org.organizationId);
  return NextResponse.json({ template });
});
