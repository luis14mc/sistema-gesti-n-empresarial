'use client';

import { Badge } from '@/components/ui/badge';
import { COMPRA_ESTADO_LABELS } from '@/lib/compras/constants';
import type { CompraEstado } from '@/types/compras';

const VARIANTS: Partial<Record<CompraEstado, 'default' | 'secondary' | 'destructive' | 'outline'>> = {
  BORRADOR: 'secondary',
  ENVIADA: 'outline',
  AUTORIZADA: 'outline',
  APROBADA: 'default',
  RECHAZADA: 'destructive',
  ORDEN_EMITIDA: 'default',
  RECIBIDA: 'default',
  CERRADA: 'outline',
  ANULADA: 'destructive',
};

export function CompraStatusBadge({ estado }: { estado: CompraEstado }) {
  return (
    <Badge variant={VARIANTS[estado] ?? 'secondary'}>
      {COMPRA_ESTADO_LABELS[estado]}
    </Badge>
  );
}
