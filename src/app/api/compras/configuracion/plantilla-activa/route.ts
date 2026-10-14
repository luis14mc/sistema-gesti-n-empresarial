import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { ensureDefaultTemplate, getActiveTemplateConfig } from '@/lib/compras/orden/template';
import { canOrdenAction, ordenActionAuthFromContext } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const role = req.user!.role as Role;
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');
  if (!(await canOrdenAction(role, 'read', {}, ordenActionAuthFromContext(org)))) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  await ensureDefaultTemplate(org.organizationId, req.user!.userId);
  const template = await getActiveTemplateConfig(org.organizationId);
  return NextResponse.json({ template });
});
