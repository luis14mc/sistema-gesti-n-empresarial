import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { calcularTotalesCompra } from './calculos';
import { allocateNumeroOrden } from './numbering';
import type { BorradorOrdenInput, UpdateOrdenInput } from './schemas';
import { validarOrdenParaGenerar } from './schemas';
import { getNextEstado, type CompraWorkflowAction } from './workflow';
import type { Role } from '@/types';
import { construirHtmlOrdenCompra } from './pdf-template';
import { renderHtmlToPdf } from './pdf-renderer';
import { getStorage } from '@/lib/storage';

export const compraInclude = {
  solicitadoPor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      position: { select: { name: true } },
    },
  },
  proveedor: true,
  items: { orderBy: { item: 'asc' as const } },
  adjuntos: {
    include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { uploadedAt: 'desc' as const },
  },
  documentos: {
    where: { activo: true },
    orderBy: { version: 'desc' as const },
    take: 1,
    include: { generadoPor: { select: { id: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.CompraSolicitudInclude;

async function resolveProveedorSnapshot(data: {
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  proveedorIdentificacion?: string | null;
  proveedorTelefono?: string | null;
  proveedorEmail?: string | null;
  proveedorContacto?: string | null;
  proveedorDireccion?: string | null;
}) {
  if (data.proveedorId) {
    const proveedor = await prisma.proveedor.findUnique({ where: { id: data.proveedorId } });
    if (proveedor) {
      return {
        proveedorId: data.proveedorId,
        proveedorNombre: proveedor.nombreRazonSocial,
        proveedorIdentificacion: proveedor.rtn,
        proveedorTelefono: proveedor.telefono,
        proveedorEmail: proveedor.email,
        proveedorContacto: proveedor.personaContacto,
        proveedorDireccion: proveedor.direccion,
      };
    }
  }
  return {
    proveedorId: data.proveedorId ?? null,
    proveedorNombre: data.proveedorNombre ?? null,
    proveedorIdentificacion: data.proveedorIdentificacion ?? null,
    proveedorTelefono: data.proveedorTelefono ?? null,
    proveedorEmail: data.proveedorEmail ?? null,
    proveedorContacto: data.proveedorContacto ?? null,
    proveedorDireccion: data.proveedorDireccion ?? null,
  };
}

function buildItems(items: BorradorOrdenInput['items'] = [], descuento = 0) {
  const safeItems = (items ?? []).filter((i) => i.descripcion?.trim());
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
    descripcion: item.descripcion,
    unidad: item.unidad,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario ?? 0,
    total: totales.lineTotals[index],
  }));
  return { mapped, totales };
}

export async function createCompraSolicitud(
  data: BorradorOrdenInput,
  solicitadoPorId: string,
  _role: Role
) {
  const user = await prisma.user.findUnique({
    where: { id: solicitadoPorId },
    include: { position: { select: { name: true } } },
  });
  const snapshot = await resolveProveedorSnapshot(data);
  const { mapped, totales } = buildItems(data.items, data.descuento ?? 0);

  return prisma.compraSolicitud.create({
    data: {
      fechaSolicitud: data.fechaSolicitud ? new Date(data.fechaSolicitud) : undefined,
      fechaRequerida: data.fechaRequerida ? new Date(data.fechaRequerida) : null,
      referenciaCompra: data.referenciaCompra ?? null,
      solicitadoPorId,
      cargoSolicitante: data.cargoSolicitante ?? user?.position?.name ?? null,
      ...snapshot,
      justificacionCompra: data.justificacionCompra ?? '',
      observacionesAdicionales: data.observacionesAdicionales ?? null,
      subtotal: totales.subtotal,
      descuento: totales.descuento,
      impuesto: totales.impuesto,
      total: totales.total,
      items: mapped.length ? { create: mapped } : undefined,
    },
    include: compraInclude,
  });
}

export async function updateCompraSolicitud(id: string, data: UpdateOrdenInput) {
  const snapshot = await resolveProveedorSnapshot(data);
  const updateData: Prisma.CompraSolicitudUpdateInput = {
    fechaRequerida: data.fechaRequerida ? new Date(data.fechaRequerida) : undefined,
    referenciaCompra: data.referenciaCompra,
    cargoSolicitante: data.cargoSolicitante,
    proveedor: snapshot.proveedorId ? { connect: { id: snapshot.proveedorId } } : undefined,
    proveedorNombre: snapshot.proveedorNombre,
    proveedorIdentificacion: snapshot.proveedorIdentificacion,
    proveedorTelefono: snapshot.proveedorTelefono,
    proveedorEmail: snapshot.proveedorEmail,
    proveedorContacto: snapshot.proveedorContacto,
    proveedorDireccion: snapshot.proveedorDireccion,
    justificacionCompra: data.justificacionCompra,
    observacionesAdicionales: data.observacionesAdicionales,
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

async function guardarPdfOrden(solicitudId: string, userId: string, version: number) {
  const solicitud = await prisma.compraSolicitud.findUnique({
    where: { id: solicitudId },
    include: compraInclude,
  });
  if (!solicitud) throw new Error('Orden no encontrada');

  const html = await construirHtmlOrdenCompra(solicitud, version);
  const buffer = await renderHtmlToPdf(html);
  const storage = getStorage();
  const slug = (solicitud.numeroOrden ?? solicitud.id).replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `orden-compra-${slug}-v${version}.pdf`;

  const stored = await storage.put({
    prefix: `compras/ordenes/${solicitudId}`,
    originalName: filename,
    mimeType: 'application/pdf',
    size: buffer.length,
    buffer,
    desiredName: filename,
  });

  await prisma.compraDocumento.updateMany({
    where: { solicitudCompraId: solicitudId, activo: true },
    data: { activo: false },
  });

  await prisma.compraDocumento.create({
    data: {
      id: randomUUID(),
      solicitudCompraId: solicitudId,
      nombreArchivo: filename,
      storagePath: stored.key,
      url: stored.url,
      version,
      generadoPorId: userId,
    },
  });

  return stored;
}

export async function applyWorkflowAction(
  id: string,
  action: CompraWorkflowAction,
  userId: string
) {
  const solicitud = await prisma.compraSolicitud.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!solicitud) throw new Error('Orden no encontrada');

  const next = getNextEstado(action, solicitud.estado);
  if (!next) throw new Error('Transición no permitida');

  if (action === 'generar_orden') {
    const errors = validarOrdenParaGenerar(solicitud);
    if (errors.length) throw new Error(errors.join('. '));

    return prisma.$transaction(async (tx) => {
      const numeroOrden = await allocateNumeroOrden(tx);
      return tx.compraSolicitud.update({
        where: { id },
        data: { estado: 'GENERADA', numeroOrden },
        include: compraInclude,
      });
    });
  }

  if (action === 'emitir' || action === 'regenerar_pdf') {
    const lastDoc = await prisma.compraDocumento.findFirst({
      where: { solicitudCompraId: id },
      orderBy: { version: 'desc' },
    });
    const version = action === 'regenerar_pdf' ? (lastDoc?.version ?? 0) + 1 : (lastDoc?.version ?? 0) + 1;

    await guardarPdfOrden(id, userId, version);

    if (action === 'emitir') {
      return prisma.compraSolicitud.update({
        where: { id },
        data: { estado: 'EMITIDA' },
        include: compraInclude,
      });
    }

    return prisma.compraSolicitud.findUnique({
      where: { id },
      include: compraInclude,
    });
  }

  return prisma.compraSolicitud.update({
    where: { id },
    data: { estado: next },
    include: compraInclude,
  });
}

export async function getOrdenHtmlPreview(solicitudId: string): Promise<string> {
  const solicitud = await prisma.compraSolicitud.findUnique({
    where: { id: solicitudId },
    include: compraInclude,
  });
  if (!solicitud) throw new Error('Orden no encontrada');

  const lastVersion = await prisma.compraDocumento.findFirst({
    where: { solicitudCompraId: solicitudId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return construirHtmlOrdenCompra(solicitud, (lastVersion?.version ?? 0) + 1);
}

export async function createProveedor(data: {
  nombreRazonSocial: string;
  rtn?: string | null;
  telefono?: string | null;
  email?: string | null;
  personaContacto?: string | null;
  direccion?: string | null;
}, organizationId: string) {
  return prisma.proveedor.create({ data: { ...data, organizationId } });
}

// Legacy alias
export const generarPdfSolicitud = getOrdenHtmlPreview;
