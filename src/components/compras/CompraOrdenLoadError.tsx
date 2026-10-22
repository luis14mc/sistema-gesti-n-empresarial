'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getApiError, getPurchaseOrderApiErrorMessage } from '@/platform/api/api-error';

export function resolveCompraOrdenDetailMessage(error: unknown): string {
  const { status } = getApiError(error);
  if (status === 403) return 'No tienes permiso para ver esta orden.';
  if (status === 404) return 'La orden no existe.';
  return getPurchaseOrderApiErrorMessage(error, 'No se pudo cargar la orden.');
}

type Props = {
  error: unknown;
  backHref?: string;
  backLabel?: string;
};

export function CompraOrdenLoadError({
  error,
  backHref = '/compras/ordenes',
  backLabel = 'Volver a órdenes',
}: Props) {
  return (
    <div className="flex flex-col items-start gap-4 p-8">
      <p className="text-muted-foreground">{resolveCompraOrdenDetailMessage(error)}</p>
      <Button asChild variant="outline">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}
