import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { getCompraOrden } from '@/modules/purchases/application/purchase-order-use-cases';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { buildPreviewDataFromSerializedOrder } from '@/modules/purchases/presentation/purchase-order-preview-data';
import { PurchaseOrderDocument } from '@/components/compras/document/PurchaseOrderDocument';
import type { Role } from '@/types';
import { requirePageOrganizationId } from '@/lib/organization-page-context';

export const dynamic = 'force-dynamic';

export default async function CompraVistaPreviaPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession();
  const organizationId = await requirePageOrganizationId(user.id);
  const { id } = await params;
  const orden = await getCompraOrden(id, organizationId);
  if (!orden?.format) notFound();
  if (!canOrdenAction(user.role as Role, 'read', { isCreator: orden.createdById === user.id })) notFound();
  const document = buildPreviewDataFromSerializedOrder(orden, orden.format);
  return <main className="h-full overflow-y-auto bg-muted p-6"><div className="mx-auto min-h-[1056px] w-[816px] bg-white px-[45px] py-[45px] shadow-lg"><PurchaseOrderDocument order={document} format={orden.format} draft={document.isDraft} /></div></main>;
}
