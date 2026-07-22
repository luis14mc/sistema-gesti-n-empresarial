'use client';

import { useDeferredValue } from 'react';
import { PurchaseOrderPreviewClient } from './document/PurchaseOrderPreviewClient';
import { useActivePurchaseOrderTemplate } from '@/hooks/useCompraOrden';
import {
  buildPreviewDataFromInput,
  buildPreviewDataFromSerializedOrder,
} from '@/lib/compras/orden/preview-data';
import type { CreatePurchaseOrderInput, DraftPurchaseOrderInput } from '@/lib/compras/orden/schemas';
import type { CompraOrden } from '@/types/compra-orden';

interface PurchaseOrderPreviewProps {
  order?: CreatePurchaseOrderInput | DraftPurchaseOrderInput | null;
  savedOrder?: CompraOrden;
}

export function PurchaseOrderPreview({ order, savedOrder }: PurchaseOrderPreviewProps) {
  const { data: format, isLoading, error } = useActivePurchaseOrderTemplate();
  const deferredOrder = useDeferredValue(order);

  if (isLoading) return <div className="flex min-h-80 items-center justify-center text-muted-foreground">Cargando formato...</div>;
  if (error || !format) return <div className="flex min-h-80 items-center justify-center text-destructive">No se pudo cargar el formato activo.</div>;

  const resolvedFormat = savedOrder?.status !== 'DRAFT' && savedOrder?.format ? savedOrder.format : format;
  const document = savedOrder
    ? deferredOrder
      ? { ...buildPreviewDataFromInput(deferredOrder, resolvedFormat), orderNumber: savedOrder.orderNumber }
      : buildPreviewDataFromSerializedOrder(savedOrder, resolvedFormat)
    : deferredOrder
      ? buildPreviewDataFromInput(deferredOrder, format)
      : null;

  if (!document) return <div className="flex min-h-80 items-center justify-center text-muted-foreground">Complete los datos para ver la vista previa.</div>;

  return <PurchaseOrderPreviewClient order={document} format={resolvedFormat} draft={document.isDraft} />;
}
