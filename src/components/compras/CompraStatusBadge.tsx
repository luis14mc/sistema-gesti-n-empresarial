'use client';

import { Badge } from '@/components/ui/badge';
import { COMPRA_ESTADO_LABELS } from '@/lib/compras/constants';
import type { CompraEstado } from '@prisma/client';

const VARIANTS: Partial<Record<CompraEstado, 'default' | 'secondary' | 'destructive' | 'outline'>> = {
  BORRADOR: 'secondary',
  RECHAZADA_JEFE: 'destructive',
  RECHAZADA_GERENCIA: 'destructive',
  ANULADA: 'destructive',
  ORDEN_EMITIDA: 'default',
  CERRADA: 'outline',
};

export function CompraStatusBadge({ estado }: { estado: CompraEstado }) {
  return (
    <Badge variant={VARIANTS[estado] ?? 'secondary'}>
      {COMPRA_ESTADO_LABELS[estado]}
    </Badge>
  );
}
