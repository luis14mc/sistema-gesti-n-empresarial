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

describe('compras workflow orden institucional', () => {
  it('transiciona de borrador a generada', () => {
    expect(getNextEstado('generar_orden', 'BORRADOR')).toBe('GENERADA');
  });

  it('transiciona de generada a emitida', () => {
    expect(getNextEstado('emitir', 'GENERADA')).toBe('EMITIDA');
  });

  it('permite generar orden al solicitante', () => {
    expect(canPerformCompraAction('IT', 'generar_orden', 'BORRADOR', { isOwner: true })).toBe(true);
  });

  it('permite emitir PDF al solicitante', () => {
    expect(canPerformCompraAction('IT', 'emitir', 'GENERADA', { isOwner: true })).toBe(true);
  });

  it('permite anular borrador al solicitante', () => {
    expect(canPerformCompraAction('IT', 'anular', 'BORRADOR', { isOwner: true })).toBe(true);
  });

  it('permite cerrar solo a ADMIN', () => {
    expect(canPerformCompraAction('ADMIN', 'cerrar', 'EMITIDA')).toBe(true);
    expect(canPerformCompraAction('IT', 'cerrar', 'EMITIDA')).toBe(true);
    expect(canPerformCompraAction('RRHH', 'cerrar', 'EMITIDA')).toBe(false);
  });
});
