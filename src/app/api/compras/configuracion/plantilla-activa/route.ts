import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { ensureDefaultTemplate, getActiveTemplateConfig } from '@/lib/compras/orden/template';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const role = req.user!.role as Role;
  const { organizationId } = await requireOrganizationContext(req);
  if (!canOrdenAction(role, 'read')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  await ensureDefaultTemplate(organizationId, req.user!.userId);
  const template = await getActiveTemplateConfig(organizationId);
  return NextResponse.json({ template });
});
