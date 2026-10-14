import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { purchaseOrderTemplateSchema } from '@/lib/compras/orden/schemas';
import { savePurchaseOrderTemplate, ensureDefaultTemplate } from '@/lib/compras/orden/template';
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
  const template = await prisma.compraOrdenTemplate.findFirst({
    where: { isActive: true, createdBy: { organizationMemberships: { some: { organizationId: org.organizationId } } } },
    orderBy: { version: 'desc' },
  });
  return NextResponse.json({ template });
});

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  const role = req.user!.role as Role;
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.update');
  if (!(await canOrdenAction(role, 'template', {}, ordenActionAuthFromContext(org)))) {
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
