export function formatPurchaseMoney(amount: number): string {
  return `L. ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;
}

export function formatPurchaseDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function draftProvisionalLabel(order: {
  purchaseReference?: string;
  referenciaCompra?: string;
  id: string;
}): string {
  return order.purchaseReference ?? order.referenciaCompra ?? `Borrador · ${order.id.slice(0, 8)}`;
}
