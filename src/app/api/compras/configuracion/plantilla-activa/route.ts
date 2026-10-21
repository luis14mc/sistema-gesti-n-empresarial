import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { ensureDefaultTemplate, getActiveTemplateConfig } from '@/modules/purchases/infrastructure/purchase-order-template';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import type { Role } from '@/types';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const role = req.user!.role as Role;
  const { organizationId } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');
  if (!canOrdenAction(role, 'read')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  await ensureDefaultTemplate(organizationId, req.user!.userId);
  const template = await getActiveTemplateConfig(organizationId);
  return NextResponse.json({ template });
});
