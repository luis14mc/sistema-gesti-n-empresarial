import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calcularTotalesCompra } from './calculos';
import { generateCompraCodigo } from './numbering';
import type { CreateCompraSolicitudInput, UpdateCompraSolicitudInput } from './schemas';
import {
  normalizeDescuento,
  normalizeRtn,
  resolveDescuentoForRole,
  validateFechas,
} from './validation';
import {
  assertCompraSolicitudUpdateScope,
  resolveCompraSolicitudScope,
} from './scope';
import type { Role } from '@/types';

export const compraInclude = {
  departamentoSolicitante: { select: { id: true, name: true } },
  centroCosto: { select: { id: true, code: true, name: true } },
  solicitadoPor: { select: { id: true, firstName: true, lastName: true, email: true, departmentId: true } },
  proveedor: true,
  autorizadoPor: { select: { id: true, firstName: true, lastName: true } },
  aprobadoPor: { select: { id: true, firstName: true, lastName: true } },
  emitidoPor: { select: { id: true, firstName: true, lastName: true } },
  items: { orderBy: { item: 'asc' as const } },
  adjuntos: {
    include: {
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { uploadedAt: 'desc' as const },
  },
  documentos: {
    include: {
      generadoPor: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { version: 'desc' as const },
  },
} satisfies Prisma.CompraSolicitudInclude;

function parseDate(value: string | undefined, fallback?: Date): Date {
  if (!value) return fallback ?? new Date();
  return new Date(value);
}

export function buildItemsWithTotals(
  items: CreateCompraSolicitudInput['items'],
  descuento?: number
) {
  const subtotalPreview = items.reduce(
    (sum, item) => sum + item.cantidad * item.precioUnitario,
    0
  );
  const normalizedDescuento = normalizeDescuento(subtotalPreview, descuento);

  const totales = calcularTotalesCompra({
    items: items.map((item) => ({
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
    })),
    descuento: normalizedDescuento,
  });

  const mapped = items.map((item, index) => ({
    item: item.item ?? index + 1,
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidad: item.unidad,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    total: totales.lineTotals[index],
  }));

  return { mapped, totales };
}

export async function createCompraSolicitud(
  data: CreateCompraSolicitudInput,
  solicitadoPorId: string,
  role: Role = 'IT'
) {
  const scoped = await resolveCompraSolicitudScope(data, solicitadoPorId, role);
  const fechaSolicitud = parseDate(scoped.fechaSolicitud);
  const fechaRequerida = parseDate(scoped.fechaRequerida);
  const fechaError = validateFechas(fechaSolicitud, fechaRequerida);
  if (fechaError) throw new Error(fechaError);

  const descuento = resolveDescuentoForRole(
    scoped.items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0),
    scoped.descuento,
    role
  );
  const { mapped, totales } = buildItemsWithTotals(scoped.items, descuento);
  const codigoSolicitud = await generateCompraCodigo(fechaSolicitud);

  return prisma.compraSolicitud.create({
    data: {
      codigoSolicitud,
      fechaSolicitud,
      fechaRequerida,
      departamentoSolicitanteId: scoped.departamentoSolicitanteId,
      centroCostoId: scoped.centroCostoId,
      solicitadoPorId,
      cargoSolicitante: scoped.cargoSolicitante,
      tipoCompra: scoped.tipoCompra,
      prioridad: scoped.prioridad,
      proveedorId: scoped.proveedorId || undefined,
      justificacionCompra: scoped.justificacionCompra,
      condicionesEntrega: scoped.condicionesEntrega,
      observacionesAdicionales: scoped.observacionesAdicionales,
      formaPago: scoped.formaPago,
      plazoPagoDias: scoped.plazoPagoDias ?? undefined,
      detallesPago: scoped.detallesPago,
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      impuesto: totales.impuesto,
      total: totales.total,
      items: { create: mapped },
    },
    include: compraInclude,
  });
}

export async function updateCompraSolicitud(
  id: string,
  data: UpdateCompraSolicitudInput,
  userId: string,
  role: Role = 'IT'
) {
  const scoped = await assertCompraSolicitudUpdateScope(data, userId, role);
  const existing = await prisma.compraSolicitud.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error('Solicitud no encontrada');

  const fechaSolicitud = scoped.fechaSolicitud
    ? parseDate(scoped.fechaSolicitud)
    : existing.fechaSolicitud;
  const fechaRequerida = scoped.fechaRequerida
    ? parseDate(scoped.fechaRequerida)
    : existing.fechaRequerida;
  const fechaError = validateFechas(fechaSolicitud, fechaRequerida);
  if (fechaError) throw new Error(fechaError);

  let totalsUpdate: Partial<{
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
  }> = {};

  if (scoped.items) {
    const descuento = resolveDescuentoForRole(
      scoped.items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0),
      scoped.descuento,
      role
    );
    const { mapped, totales } = buildItemsWithTotals(scoped.items, descuento);
    await prisma.compraSolicitudItem.deleteMany({ where: { solicitudCompraId: id } });
    await prisma.compraSolicitudItem.createMany({
      data: mapped.map((item) => ({ ...item, solicitudCompraId: id })),
    });
    totalsUpdate = {
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      impuesto: totales.impuesto,
      total: totales.total,
    };
  } else if (scoped.descuento !== undefined) {
    const items = await prisma.compraSolicitudItem.findMany({
      where: { solicitudCompraId: id },
      select: { cantidad: true, precioUnitario: true },
    });
    const descuento = resolveDescuentoForRole(
      items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0),
      scoped.descuento,
      role
    );
    const totales = calcularTotalesCompra({ items, descuento });
    totalsUpdate = {
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      impuesto: totales.impuesto,
      total: totales.total,
    };
  }

  return prisma.compraSolicitud.update({
    where: { id },
    data: {
      fechaSolicitud: scoped.fechaSolicitud ? fechaSolicitud : undefined,
      fechaRequerida: scoped.fechaRequerida ? fechaRequerida : undefined,
      departamentoSolicitanteId: scoped.departamentoSolicitanteId,
      centroCostoId: scoped.centroCostoId,
      cargoSolicitante: scoped.cargoSolicitante,
      tipoCompra: scoped.tipoCompra,
      prioridad: scoped.prioridad,
      proveedorId: scoped.proveedorId === null ? null : scoped.proveedorId,
      justificacionCompra: scoped.justificacionCompra,
      condicionesEntrega: scoped.condicionesEntrega,
      observacionesAdicionales: scoped.observacionesAdicionales,
      formaPago: scoped.formaPago,
      plazoPagoDias: scoped.plazoPagoDias === null ? null : scoped.plazoPagoDias,
      detallesPago: scoped.detallesPago,
      ...totalsUpdate,
    },
    include: compraInclude,
  });
}

export async function createProveedor(data: {
  nombreRazonSocial: string;
  rtn?: string | null;
  telefono?: string | null;
  email?: string | null;
  personaContacto?: string | null;
  direccion?: string | null;
}) {
  return prisma.proveedor.create({
    data: {
      nombreRazonSocial: data.nombreRazonSocial,
      rtn: normalizeRtn(data.rtn),
      telefono: data.telefono ?? undefined,
      email: data.email || undefined,
      personaContacto: data.personaContacto ?? undefined,
      direccion: data.direccion ?? undefined,
    },
  });
}
