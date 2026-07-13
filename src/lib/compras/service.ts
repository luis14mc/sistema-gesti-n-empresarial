import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calcularTotalesCompra } from './calculos';
import { generateCompraNumero } from './numbering';
import type { CreateCompraSolicitudInput, UpdateCompraSolicitudInput, BorradorCompraSolicitudInput } from './schemas';
import { getNextEstado, type CompraWorkflowAction } from './workflow';
import type { Role } from '@/types';
import { construirHtmlSolicitudCompra } from './pdf-template';
import { renderHtmlToPdf } from './pdf-renderer';
import { getStorage } from '@/lib/storage';

export const compraInclude = {
  departamentoSolicitante: { select: { id: true, name: true } },
  centroCosto: { select: { id: true, code: true, name: true } },
  solicitadoPor: {
    select: { id: true, firstName: true, lastName: true, email: true, departmentId: true, position: { select: { name: true } } },
  },
  proveedor: true,
  autorizadoPor: { select: { id: true, firstName: true, lastName: true } },
  aprobadoPor: { select: { id: true, firstName: true, lastName: true } },
  rechazadoPor: { select: { id: true, firstName: true, lastName: true } },
  items: { orderBy: { item: 'asc' as const } },
  adjuntos: {
    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { uploadedAt: 'desc' as const },
  },
} satisfies Prisma.CompraSolicitudInclude;

async function resolveProveedorFields(data: {
  proveedorId?: string | null;
  proveedorNombre?: string;
  proveedorIdentificacion?: string | null;
  proveedorTelefono?: string | null;
  proveedorEmail?: string | null;
  proveedorContacto?: string | null;
  proveedorDireccion?: string | null;
}) {
  if (!data.proveedorId) return data;
  const proveedor = await prisma.proveedor.findUnique({ where: { id: data.proveedorId } });
  if (!proveedor) return data;
  return {
    ...data,
    proveedorNombre: data.proveedorNombre || proveedor.nombreRazonSocial,
    proveedorIdentificacion: data.proveedorIdentificacion ?? proveedor.rtn,
    proveedorTelefono: data.proveedorTelefono ?? proveedor.telefono,
    proveedorEmail: data.proveedorEmail ?? proveedor.email,
    proveedorContacto: data.proveedorContacto ?? proveedor.personaContacto,
    proveedorDireccion: data.proveedorDireccion ?? proveedor.direccion,
  };
}

function buildItems(items: BorradorCompraSolicitudInput['items'] = [], descuento = 0) {
  const safeItems = items.filter((i) => i.descripcion?.trim());
  if (!safeItems.length) {
    return {
      mapped: [],
      totales: { lineTotals: [], subtotal: 0, descuento: 0, impuesto: 0, total: 0 },
    };
  }
  const totales = calcularTotalesCompra({
    items: safeItems.map((i) => ({
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario ?? 0,
    })),
    descuento,
  });

  const mapped = safeItems.map((item, index) => ({
    item: item.item ?? index + 1,
    codigo: item.codigo,
    descripcion: item.descripcion,
    unidad: item.unidad,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario ?? 0,
    total: totales.lineTotals[index],
  }));

  return { mapped, totales };
}

export async function createCompraSolicitud(
  data: BorradorCompraSolicitudInput,
  solicitadoPorId: string,
  _role: Role
) {
  const numero = await generateCompraNumero();
  const resolved = await resolveProveedorFields(data);
  const { mapped, totales } = buildItems(data.items, data.descuento ?? 0);

  let departamentoId = data.departamentoSolicitanteId;
  let cargo = data.cargoSolicitante;
  if (!departamentoId || !cargo) {
    const user = await prisma.user.findUnique({
      where: { id: solicitadoPorId },
      include: { position: { select: { name: true } } },
    });
    if (!departamentoId) departamentoId = user?.departmentId ?? undefined;
    if (!cargo) cargo = user?.position?.name ?? undefined;
  }

  return prisma.compraSolicitud.create({
    data: {
      numero,
      fechaSolicitud: data.fechaSolicitud ? new Date(data.fechaSolicitud) : undefined,
      fechaRequerida: data.fechaRequerida ? new Date(data.fechaRequerida) : null,
      departamentoSolicitanteId: departamentoId ?? null,
      centroCostoId: data.centroCostoId ?? null,
      solicitadoPorId,
      cargoSolicitante: cargo ?? null,
      tipoCompra: data.tipoCompra ?? 'BIENES',
      prioridad: data.prioridad ?? 'NORMAL',
      proveedorId: resolved.proveedorId ?? null,
      proveedorNombre: resolved.proveedorNombre ?? null,
      proveedorIdentificacion: resolved.proveedorIdentificacion ?? null,
      proveedorTelefono: resolved.proveedorTelefono ?? null,
      proveedorEmail: resolved.proveedorEmail ?? null,
      proveedorContacto: resolved.proveedorContacto ?? null,
      proveedorDireccion: resolved.proveedorDireccion ?? null,
      justificacionCompra: data.justificacionCompra ?? '',
      condicionesEntrega: data.condicionesEntrega ?? null,
      observacionesAdicionales: data.observacionesAdicionales ?? null,
      formaPago: data.formaPago ?? 'CONTADO',
      plazoPagoDias: data.plazoPagoDias ?? null,
      detallesPago: data.detallesPago ?? null,
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      impuesto: totales.impuesto,
      total: totales.total,
      items: mapped.length ? { create: mapped } : undefined,
    },
    include: compraInclude,
  });
}

export async function updateCompraSolicitud(id: string, data: UpdateCompraSolicitudInput) {
  const resolved =
    data.proveedorId || data.proveedorNombre
      ? await resolveProveedorFields(data)
      : data;

  const updateData: Prisma.CompraSolicitudUpdateInput = {
    fechaRequerida: data.fechaRequerida ? new Date(data.fechaRequerida) : undefined,
    departamentoSolicitante: data.departamentoSolicitanteId
      ? { connect: { id: data.departamentoSolicitanteId } }
      : undefined,
    centroCosto: data.centroCostoId ? { connect: { id: data.centroCostoId } } : undefined,
    cargoSolicitante: data.cargoSolicitante,
    tipoCompra: data.tipoCompra,
    prioridad: data.prioridad,
    proveedor: resolved.proveedorId ? { connect: { id: resolved.proveedorId } } : undefined,
    proveedorNombre: resolved.proveedorNombre,
    proveedorIdentificacion: resolved.proveedorIdentificacion,
    proveedorTelefono: resolved.proveedorTelefono,
    proveedorEmail: resolved.proveedorEmail,
    proveedorContacto: resolved.proveedorContacto,
    proveedorDireccion: resolved.proveedorDireccion,
    justificacionCompra: data.justificacionCompra,
    condicionesEntrega: data.condicionesEntrega,
    observacionesAdicionales: data.observacionesAdicionales,
    formaPago: data.formaPago,
    plazoPagoDias: data.plazoPagoDias,
    detallesPago: data.detallesPago,
  };

  if (data.items) {
    const { mapped, totales } = buildItems(data.items, data.descuento ?? 0);
    updateData.subtotal = totales.subtotal;
    updateData.descuento = totales.descuento;
    updateData.impuesto = totales.impuesto;
    updateData.total = totales.total;
    updateData.items = { deleteMany: {}, create: mapped };
  } else if (data.descuento != null) {
    const existing = await prisma.compraSolicitud.findUnique({
      where: { id },
      include: { items: true },
    });
    if (existing) {
      const { totales } = buildItems(
        existing.items.map((i) => ({
          descripcion: i.descripcion,
          unidad: i.unidad,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        })),
        data.descuento
      );
      updateData.descuento = totales.descuento;
      updateData.impuesto = totales.impuesto;
      updateData.total = totales.total;
    }
  }

  return prisma.compraSolicitud.update({
    where: { id },
    data: updateData,
    include: compraInclude,
  });
}

export async function applyWorkflowAction(
  id: string,
  action: CompraWorkflowAction,
  userId: string,
  extra?: { motivoRechazo?: string }
) {
  const solicitud = await prisma.compraSolicitud.findUnique({ where: { id } });
  if (!solicitud) throw new Error('Solicitud no encontrada');

  const next = getNextEstado(action, solicitud.estado);
  if (!next) throw new Error('Transición no permitida');

  const now = new Date();
  const data: Prisma.CompraSolicitudUpdateInput = { estado: next };

  if (action === 'autorizar') {
    data.autorizadoPor = { connect: { id: userId } };
    data.autorizadoEn = now;
  }
  if (action === 'aprobar') {
    data.aprobadoPor = { connect: { id: userId } };
    data.aprobadoEn = now;
  }
  if (action === 'rechazar') {
    data.rechazadoPor = { connect: { id: userId } };
    data.rechazadoEn = now;
    data.motivoRechazo = extra?.motivoRechazo ?? 'Sin motivo';
  }
  if (action === 'emitir_orden') {
    data.emitidoPorId = userId;
    data.emitidoEn = now;
  }

  const updated = await prisma.compraSolicitud.update({
    where: { id },
    data,
    include: compraInclude,
  });

  if (action === 'emitir_orden') {
    const pdfUrl = await generarPdfSolicitud(id);
    return prisma.compraSolicitud.update({
      where: { id },
      data: { documentoPdfUrl: pdfUrl },
      include: compraInclude,
    });
  }

  return updated;
}

export async function generarPdfSolicitud(solicitudId: string): Promise<string> {
  const solicitud = await prisma.compraSolicitud.findUnique({
    where: { id: solicitudId },
    include: compraInclude,
  });
  if (!solicitud) throw new Error('Solicitud no encontrada');

  const html = await construirHtmlSolicitudCompra(solicitud);
  const buffer = await renderHtmlToPdf(html);
  const storage = getStorage();
  const filename = `orden-compra-${solicitud.numero.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

  const stored = await storage.put({
    prefix: `compras/solicitudes/${solicitudId}`,
    originalName: filename,
    mimeType: 'application/pdf',
    size: buffer.length,
    buffer,
    desiredName: filename,
  });

  return stored.url;
}

export async function createProveedor(data: {
  nombreRazonSocial: string;
  rtn?: string | null;
  telefono?: string | null;
  email?: string | null;
  personaContacto?: string | null;
  direccion?: string | null;
}) {
  return prisma.proveedor.create({ data });
}
