import { NextResponse } from 'next/server';
import type { PurchaseDocumentType } from '@prisma/client';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { uploadCompraOrdenDocumento, getCompraOrden, getPurchaseOrderDocuments } from '@/modules/purchases/application/purchase-order-use-cases';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { loadEffectivePermissions } from '@/modules/purchases/presentation/purchase-order-effective-permissions';
import { authorizeOrganization } from '@/platform/security/authorization/http';

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
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');
  const permissions = await loadEffectivePermissions(org);
  const { id } = await params;
  const orden = await getCompraOrden(id, org.organizationId);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (
    !canOrdenAction(permissions, 'read', {
      membershipRole: org.role,
      sessionRole: req.user!.role,
      isCreator: orden.createdById === req.user!.userId,
      status: orden.status,
    })
  ) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const documents = await getPurchaseOrderDocuments(id, org.organizationId);
  return NextResponse.json({ documents });
});

export const POST = withAuth(async (req: AuthenticatedRequest, { params }) => {
  const org = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.update');
  const permissions = await loadEffectivePermissions(org);
  const { id } = await params;
  const orden = await getCompraOrden(id, org.organizationId);
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  if (
    !canOrdenAction(permissions, 'documentos', {
      membershipRole: org.role,
      sessionRole: req.user!.role,
      isCreator: orden.createdById === req.user!.userId,
    })
  ) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  const formData = await req.formData();
  const uploaded = formData.get('file');
  const tipoRaw = ((formData.get('tipo') as string) || 'OTHER').toUpperCase();
  const tipo = TIPO_MAP[tipoRaw] ?? 'OTHER';
  if (!(uploaded instanceof Blob) || uploaded.size === 0) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  }
  const uploadedBlob = uploaded as Blob;
  const file = new File(
    [uploadedBlob],
    uploaded instanceof File ? uploaded.name : 'adjunto',
    { type: uploadedBlob.type || 'application/octet-stream' },
  );
  try {
    const documento = await uploadCompraOrdenDocumento(id, file, tipo, req.user!.userId, org.organizationId);
    return NextResponse.json({ documento }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
});
