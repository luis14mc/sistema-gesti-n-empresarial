'use client';

import { Badge } from '@/components/ui/badge';
import { COMPRA_ESTADO_LABELS } from '@/lib/compras/constants';
import type { CompraEstado } from '@/types/compras';

const VARIANTS: Partial<Record<string, 'default' | 'secondary' | 'destructive' | 'outline'>> = {
  BORRADOR: 'secondary',
  DRAFT: 'secondary',
  GENERADA: 'outline',
  GENERATED: 'outline',
  EMITIDA: 'default',
  ISSUED: 'default',
  CERRADA: 'outline',
  CLOSED: 'outline',
  ANULADA: 'destructive',
  CANCELLED: 'destructive',
};

export function CompraStatusBadge({ estado, label }: { estado: string; label?: string }) {
  return (
    <Badge variant={VARIANTS[estado] ?? 'secondary'}>
      {label ?? COMPRA_ESTADO_LABELS[estado as CompraEstado] ?? estado}
    </Badge>
  );
}
