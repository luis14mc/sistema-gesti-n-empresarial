import { describe, it, expect } from 'vitest';
import type { CompraSolicitud, CompraSolicitudItem } from '../src/types/compras';

describe('compras frontend types (orden institucional)', () => {
  it('modela orden con campos institucionales', () => {
    const solicitud: Pick<
      CompraSolicitud,
      'numeroOrden' | 'referenciaCompra' | 'estado' | 'proveedorNombre'
    > = {
      numeroOrden: 'OC-CNI-0001-2026',
      referenciaCompra: 'REF-2026-001',
      estado: 'GENERADA',
      proveedorNombre: 'Proveedor Demo S.A.',
    };
    expect(solicitud.estado).toBe('GENERADA');
    expect(solicitud.numeroOrden).toBe('OC-CNI-0001-2026');
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
