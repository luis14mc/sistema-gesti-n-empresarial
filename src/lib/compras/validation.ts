import type { CompraEstado } from '@prisma/client';
import { COMPRA_ESTADOS_TERMINALES } from './constants';
import type { Role } from '@/types';

const RTN_REGEX = /^\d{14}$/;

export function validateRtn(rtn?: string | null): boolean {
  if (!rtn || rtn.trim() === '') return true;
  const normalized = rtn.replace(/\D/g, '');
  return RTN_REGEX.test(normalized);
}

export function normalizeRtn(rtn?: string | null): string | undefined {
  if (!rtn) return undefined;
  const normalized = rtn.replace(/\D/g, '');
  return normalized || undefined;
}

export function isCompraEditable(estado: CompraEstado): boolean {
  return estado === 'BORRADOR';
}

export function isCompraTerminal(estado: CompraEstado): boolean {
  return COMPRA_ESTADOS_TERMINALES.includes(estado);
}

export function canEditMontos(estado: CompraEstado, role: string): boolean {
  if (isCompraEditable(estado)) return true;
  return role === 'ADMIN' && ['PENDIENTE_COMPRAS', 'APROBADA_GERENCIA'].includes(estado);
}

export function validateFechas(fechaSolicitud: Date, fechaRequerida: Date): string | null {
  if (fechaRequerida < fechaSolicitud) {
    return 'La fecha requerida no puede ser anterior a la fecha de solicitud';
  }
  return null;
}

export function normalizeDescuento(subtotal: number, descuento?: number): number {
  const value = descuento ?? 0;
  if (value < 0) return 0;
  return Math.min(value, subtotal);
}

export function resolveDescuentoForRole(
  subtotal: number,
  descuento: number | undefined,
  role: Role
): number {
  if (role !== 'ADMIN') return 0;
  return normalizeDescuento(subtotal, descuento);
}
