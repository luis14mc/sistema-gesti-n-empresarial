import { describe, expect, it } from 'vitest';
import {
  parsePurchaseOrderListStatus,
  resolveComprasSolicitudesRedirect,
} from '@/lib/compras/orden/list-status-filter';

describe('compras list status filters', () => {
  it('defaults to active generated orders when status is omitted', () => {
    expect(parsePurchaseOrderListStatus(undefined)).toEqual({
      statusIn: ['GENERATED', 'ISSUED'],
    });
    expect(parsePurchaseOrderListStatus(null)).toEqual({
      statusIn: ['GENERATED', 'ISSUED'],
    });
  });

  it('maps DRAFT and legacy BORRADOR', () => {
    expect(parsePurchaseOrderListStatus('DRAFT')).toEqual({ status: 'DRAFT' });
    expect(parsePurchaseOrderListStatus('BORRADOR')).toEqual({ status: 'DRAFT' });
  });

  it('maps closed and cancelled filters', () => {
    expect(parsePurchaseOrderListStatus('closed')).toEqual({ status: 'CLOSED' });
    expect(parsePurchaseOrderListStatus('cancelled')).toEqual({ status: 'CANCELLED' });
  });

  it('redirects legacy solicitudes routes', () => {
    expect(resolveComprasSolicitudesRedirect(new URLSearchParams())).toBe('/compras/ordenes');
    expect(resolveComprasSolicitudesRedirect(new URLSearchParams('estado=DRAFT'))).toBe(
      '/compras/borradores',
    );
    expect(resolveComprasSolicitudesRedirect(new URLSearchParams('status=BORRADOR'))).toBe(
      '/compras/borradores',
    );
  });
});
