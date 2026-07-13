import { describe, it, expect } from 'vitest';
import type { CompraSolicitud, CompraSolicitudItem } from '../src/types/compras';

describe('compras frontend types (ficha Excel)', () => {
  it('modela solicitud con campos institucionales', () => {
    const solicitud: Pick<
      CompraSolicitud,
      'numero' | 'tipoCompra' | 'prioridad' | 'estado' | 'proveedorNombre' | 'formaPago'
    > = {
      numero: 'SC-0001-2026',
      tipoCompra: 'BIENES',
      prioridad: 'NORMAL',
      estado: 'AUTORIZADA',
      proveedorNombre: 'Proveedor SA',
      formaPago: 'CONTADO',
    };
    expect(solicitud.estado).toBe('AUTORIZADA');
  });

  it('modela ítems con precio unitario y total', () => {
    const item: CompraSolicitudItem = {
      id: 'item-1',
      solicitudCompraId: 'sol-1',
      item: 1,
      descripcion: 'Laptop',
      unidad: 'UNIDAD',
      cantidad: 5,
      precioUnitario: 25000,
      total: 125000,
    };
    expect(item.total).toBe(125000);
  });
});
