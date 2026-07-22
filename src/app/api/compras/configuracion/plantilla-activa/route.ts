import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { ensureDefaultTemplate, getActiveTemplateConfig } from '@/lib/compras/orden/template';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const role = req.user!.role as Role;
  if (!canOrdenAction(role, 'read')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  await ensureDefaultTemplate(req.user!.userId);
  const template = await getActiveTemplateConfig();
  return NextResponse.json({ template });
});
