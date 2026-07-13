import { describe, it, expect } from 'vitest';
import { calcularLineaTotal, calcularTotalesCompra } from '../src/lib/compras/calculos';
import { getNextEstado, canPerformCompraAction } from '../src/lib/compras/workflow';
import { validateRtn, normalizeDescuento, resolveDescuentoForRole } from '../src/lib/compras/validation';

describe('compras calculos', () => {
  it('calcula total de línea', () => {
    expect(calcularLineaTotal(3, 100)).toBe(300);
  });

  it('calcula subtotal, impuesto y total', () => {
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

describe('compras workflow', () => {
  it('transiciona de borrador a pendiente autorización', () => {
    expect(getNextEstado('enviar', 'BORRADOR')).toBe('PENDIENTE_AUTORIZACION_JEFE');
  });

  it('permite enviar al solicitante', () => {
    expect(canPerformCompraAction('IT', 'enviar', 'BORRADOR', { isOwner: true })).toBe(true);
  });

  it('permite autorizar a RRHH del departamento solicitante', () => {
    expect(
      canPerformCompraAction('RRHH', 'autorizar', 'PENDIENTE_AUTORIZACION_JEFE', {
        sameDepartment: true,
      })
    ).toBe(true);
  });

  it('no permite autorizar a RRHH de otro departamento', () => {
    expect(
      canPerformCompraAction('RRHH', 'autorizar', 'PENDIENTE_AUTORIZACION_JEFE', {
        sameDepartment: false,
      })
    ).toBe(false);
  });
});

describe('compras RTN', () => {
  it('valida RTN de 14 dígitos', () => {
    expect(validateRtn('08011990123456')).toBe(true);
    expect(validateRtn('123')).toBe(false);
    expect(validateRtn('')).toBe(true);
  });
});

describe('compras descuento', () => {
  it('limita descuento al subtotal', () => {
    expect(normalizeDescuento(1000, 1500)).toBe(1000);
    expect(normalizeDescuento(1000, -5)).toBe(0);
  });

  it('solo ADMIN puede aplicar descuento', () => {
    expect(resolveDescuentoForRole(1000, 100, 'IT')).toBe(0);
    expect(resolveDescuentoForRole(1000, 100, 'ADMIN')).toBe(100);
  });
});
