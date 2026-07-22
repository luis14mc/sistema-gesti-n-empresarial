import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { getCompraOrden } from '@/lib/compras/orden/service';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import { buildPreviewDataFromSerializedOrder } from '@/lib/compras/orden/preview-data';
import { PurchaseOrderPrintDocument } from '@/components/compras/PurchaseOrderPrintDocument';
import type { Role } from '@/types';

export const dynamic = 'force-dynamic';

export default async function CompraImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession();
  const { id } = await params;
  const orden = await getCompraOrden(id);
  if (!orden?.format) notFound();
  if (!canOrdenAction(user.role as Role, 'read', { isCreator: orden.createdById === user.id })) notFound();
  const document = buildPreviewDataFromSerializedOrder(orden, orden.format);
  return <main className="mx-auto w-[816px] bg-white px-[45px] py-[45px]"><PurchaseOrderPrintDocument order={document} format={orden.format} draft={document.isDraft} autoPrint /></main>;
}
