import { COMPRA_IMPUESTO_TASA } from './constants';

export function calcularLineaTotal(cantidad: number, precioUnitario: number): number {
  return Math.round(cantidad * precioUnitario * 100) / 100;
}

export function calcularTotalesCompra(params: {
  items: Array<{ cantidad: number; precioUnitario: number }>;
  descuento?: number;
  impuestoTasa?: number;
}) {
  const lineTotals = params.items.map((item) =>
    calcularLineaTotal(item.cantidad, item.precioUnitario)
  );
  const subtotal = Math.round(lineTotals.reduce((sum, t) => sum + t, 0) * 100) / 100;
  const descuento = Math.min(Math.max(params.descuento ?? 0, 0), subtotal);
  const base = subtotal - descuento;
  const tasa = params.impuestoTasa ?? COMPRA_IMPUESTO_TASA;
  const impuesto = Math.round(base * tasa * 100) / 100;
  const total = Math.round((base + impuesto) * 100) / 100;
  return { lineTotals, subtotal, descuento, impuesto, total };
}
