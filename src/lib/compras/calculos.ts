import { COMPRA_IMPUESTO_TASA } from './constants';

export interface CompraItemCalculoInput {
  cantidad: number;
  precioUnitario: number;
}

export interface CompraTotalesInput {
  items: CompraItemCalculoInput[];
  descuento?: number;
  impuestoTasa?: number;
}

export interface CompraTotalesResult {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  lineTotals: number[];
}

export function calcularLineaTotal(cantidad: number, precioUnitario: number): number {
  return roundMoney(cantidad * precioUnitario);
}

export function calcularTotalesCompra(input: CompraTotalesInput): CompraTotalesResult {
  const descuento = input.descuento ?? 0;
  const impuestoTasa = input.impuestoTasa ?? COMPRA_IMPUESTO_TASA;

  const lineTotals = input.items.map((item) =>
    calcularLineaTotal(item.cantidad, item.precioUnitario)
  );
  const subtotal = roundMoney(lineTotals.reduce((sum, value) => sum + value, 0));
  const baseImponible = Math.max(subtotal - descuento, 0);
  const impuesto = roundMoney(baseImponible * impuestoTasa);
  const total = roundMoney(baseImponible + impuesto);

  return { subtotal, descuento, impuesto, total, lineTotals };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
