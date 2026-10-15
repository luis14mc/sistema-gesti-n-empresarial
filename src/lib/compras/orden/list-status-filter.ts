import type { PurchaseOrderStatus } from '@prisma/client';
import { mapLegacyEstadoFilter } from './prisma-error';

const GENERATED_LIST_STATUSES = ['GENERATED', 'ISSUED', 'CLOSED', 'CANCELLED'] as const satisfies readonly PurchaseOrderStatus[];

export type GeneratedOrdersStatusFilter = 'active' | 'closed' | 'cancelled' | 'all';

export function resolveComprasSolicitudesRedirect(searchParams: URLSearchParams): string {
  const estado = searchParams.get('estado') ?? searchParams.get('status');
  const normalized = mapLegacyEstadoFilter(estado ?? undefined);
  if (normalized === 'DRAFT' || estado === 'BORRADOR') return '/compras/borradores';
  return '/compras/ordenes';
}

export function parsePurchaseOrderListStatus(statusParam?: string | null): {
  status?: PurchaseOrderStatus;
  statusIn?: PurchaseOrderStatus[];
} {
  if (!statusParam) {
    return { statusIn: ['GENERATED', 'ISSUED'] };
  }

  const trimmed = statusParam.trim();
  if (trimmed === 'active') return { statusIn: ['GENERATED', 'ISSUED'] };
  if (trimmed === 'closed') return { status: 'CLOSED' };
  if (trimmed === 'cancelled') return { status: 'CANCELLED' };
  if (trimmed === 'all') return { statusIn: [...GENERATED_LIST_STATUSES] };

  if (trimmed.includes(',')) {
    const statusIn = trimmed
      .split(',')
      .map((part) => mapLegacyEstadoFilter(part.trim()))
      .filter((value): value is PurchaseOrderStatus => Boolean(value));
    return statusIn.length ? { statusIn } : { statusIn: ['GENERATED', 'ISSUED'] };
  }

  const single = mapLegacyEstadoFilter(trimmed);
  if (!single) return { statusIn: ['GENERATED', 'ISSUED'] };
  if (single === 'DRAFT') return { status: 'DRAFT' };
  return { status: single as PurchaseOrderStatus };
}
