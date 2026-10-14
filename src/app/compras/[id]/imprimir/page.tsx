import { redirect } from 'next/navigation';

/**
 * Legacy HTML print view — superseded by printing the official stored ORDER_PDF via
 * `PrintPurchaseOrderPdfButton` on the order detail page.
 */
export default async function CompraImprimirLegacyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/compras/ordenes/${id}`);
}
