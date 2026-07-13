import { describe, it, expect } from 'vitest';
import { calcularLineaTotal, calcularTotalesCompra } from '../src/lib/compras/calculos';
import { getNextEstado, canPerformCompraAction } from '../src/lib/compras/workflow';

describe('compras calculos', () => {
  it('calcula total de línea', () => {
    expect(calcularLineaTotal(3, 100)).toBe(300);
  });

  it('calcula subtotal, descuento, impuesto y total', () => {
    const result = calcularTotalesCompra({
      items: [
        { cantidad: 2, precioUnitario: 100 },
        { cantidad: 1, precioUnitario: 50 },
      ],
      descuento: 10,
    });
    expect(result.subtotal).toBe(250);
    expect(result.impuesto).toBe(36);
    expect(result.total).toBe(276);
  });
});

describe('compras workflow ficha Excel', () => {
  it('transiciona de borrador a enviada', () => {
    expect(getNextEstado('enviar', 'BORRADOR')).toBe('ENVIADA');
  });

  it('transiciona de enviada a autorizada', () => {
    expect(getNextEstado('autorizar', 'ENVIADA')).toBe('AUTORIZADA');
  });

  it('transiciona de autorizada a aprobada', () => {
    expect(getNextEstado('aprobar', 'AUTORIZADA')).toBe('APROBADA');
  });

  it('transiciona de aprobada a orden emitida', () => {
    expect(getNextEstado('emitir_orden', 'APROBADA')).toBe('ORDEN_EMITIDA');
  });

  it('permite enviar al solicitante', () => {
    expect(canPerformCompraAction('IT', 'enviar', 'BORRADOR', { isOwner: true })).toBe(true);
  });

  it('permite autorizar a RRHH del mismo departamento', () => {
    expect(
      canPerformCompraAction('RRHH', 'autorizar', 'ENVIADA', { sameDepartment: true })
    ).toBe(true);
  });

  it('permite aprobar solo a ADMIN', () => {
    expect(canPerformCompraAction('ADMIN', 'aprobar', 'AUTORIZADA')).toBe(true);
    expect(
      canPerformCompraAction('RRHH', 'aprobar', 'AUTORIZADA', { sameDepartment: true })
    ).toBe(false);
  });
});
