import { NextResponse } from 'next/server';
import type { PurchaseDocumentType } from '@prisma/client';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { uploadCompraOrdenDocumento, getCompraOrden, getPurchaseOrderDocuments } from '@/lib/compras/orden/service';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

const TIPO_MAP: Record<string, PurchaseDocumentType> = {
  QUOTATION: 'QUOTATION',
  COTIZACION: 'QUOTATION',
  INVOICE: 'INVOICE',
  FACTURA: 'INVOICE',
  PROFORMA: 'PROFORMA',
  SUPPORT: 'SUPPORT',
  SOPORTE: 'SUPPORT',
  RECEIPT: 'RECEIPT',
  ACTA_RECEPCION: 'RECEIPT',
  OTHER: 'OTHER',
  OTRO: 'OTHER',
};

export const GET = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const { organizationId } = await requireOrganizationContext(req);
  const { id } = await params;
  const orden = await getCompraOrden(id, organizationId);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!canOrdenAction(role, 'read')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const documents = await getPurchaseOrderDocuments(id, organizationId);
  return NextResponse.json({ documents });
});

export const POST = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const role = req.user!.role as Role;
  const { organizationId } = await requireOrganizationContext(req);
  const { id } = await params;
  const orden = await getCompraOrden(id, organizationId);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (!canOrdenAction(role, 'documentos', { isCreator: orden.createdById === req.user!.userId })) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const formData = await req.formData();
  const file = formData.get('file');
  const tipoRaw = ((formData.get('tipo') as string) || 'OTHER').toUpperCase();
  const tipo = TIPO_MAP[tipoRaw] ?? 'OTHER';
  if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  try {
    const documento = await uploadCompraOrdenDocumento(id, file, tipo, req.user!.userId, organizationId);
    return NextResponse.json({ documento }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
});
