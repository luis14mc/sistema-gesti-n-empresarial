import { readFile } from 'fs/promises';
import path from 'path';
import type { CompraDocumento, CompraTipoDocumento } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { logCompraAudit } from '@/lib/compras/audit';
import { COMPRA_AUDIT } from '@/lib/compras/audit-actions';
import { compraInclude } from '@/lib/compras/service';
import { formatDocumentoMetadata } from '@/lib/compras/document-metadata';
import {
  construirHtmlSolicitudCompra,
  type SolicitudPdfData,
} from '@/lib/compras/pdf-template';
import { renderHtmlToPdf } from '@/lib/compras/pdf-renderer';

const TIPO_DOCUMENTO: CompraTipoDocumento = 'ORDEN_COMPRA_PDF';

export { construirHtmlSolicitudCompra };

export async function fetchSolicitudForPdf(solicitudId: string) {
  return prisma.compraSolicitud.findFirst({
    where: { id: solicitudId, deletedAt: null },
    include: compraInclude,
  });
}

export async function guardarDocumentoSolicitudCompra(params: {
  solicitudId: string;
  generadoPorId: string;
  pdfBuffer: Buffer;
  codigoSolicitud: string;
  version: number;
}) {
  const storage = getStorage();
  const nombreArchivo = `orden-compra-v${params.version}.pdf`;

  const stored = await storage.put({
    prefix: `compras/solicitudes/${params.solicitudId}`,
    originalName: nombreArchivo,
    mimeType: 'application/pdf',
    size: params.pdfBuffer.length,
    buffer: params.pdfBuffer,
    desiredName: nombreArchivo,
  });

  await prisma.compraDocumento.updateMany({
    where: {
      solicitudCompraId: params.solicitudId,
      tipoDocumento: TIPO_DOCUMENTO,
      activo: true,
    },
    data: { activo: false },
  });

  return prisma.compraDocumento.create({
    data: {
      solicitudCompraId: params.solicitudId,
      tipoDocumento: TIPO_DOCUMENTO,
      nombreArchivo,
      mimeType: 'application/pdf',
      storagePath: stored.key,
      url: stored.url,
      version: params.version,
      activo: true,
      generadoPorId: params.generadoPorId,
    },
    include: {
      generadoPor: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function generarPdfSolicitudCompra(
  solicitudId: string,
  generadoPorId: string,
  options?: {
    auditAction?: typeof COMPRA_AUDIT.DOCUMENTO_GENERADO | typeof COMPRA_AUDIT.DOCUMENTO_REGENERADO;
  }
): Promise<CompraDocumento> {
  const solicitud = await fetchSolicitudForPdf(solicitudId);
  if (!solicitud) throw new Error('Solicitud no encontrada');

  const latest = await prisma.compraDocumento.findFirst({
    where: { solicitudCompraId: solicitudId, tipoDocumento: TIPO_DOCUMENTO },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const html = await construirHtmlSolicitudCompra(solicitud as SolicitudPdfData, {
    version: nextVersion,
  });
  const pdfBuffer = await renderHtmlToPdf(html);

  const documento = await guardarDocumentoSolicitudCompra({
    solicitudId,
    generadoPorId,
    pdfBuffer,
    codigoSolicitud: solicitud.codigoSolicitud,
    version: nextVersion,
  });

  await logCompraAudit({
    userId: generadoPorId,
    solicitudId,
    documentoId: documento.id,
    action: options?.auditAction ?? COMPRA_AUDIT.DOCUMENTO_GENERADO,
    detalles: `${documento.nombreArchivo} (v${documento.version})`,
    newData: documento,
  });

  return documento;
}

export async function obtenerDocumentoSolicitudCompra(solicitudId: string) {
  return getDocumentoActivoSolicitud(solicitudId);
}

export async function getDocumentoActivoSolicitud(solicitudId: string) {
  return prisma.compraDocumento.findFirst({
    where: {
      solicitudCompraId: solicitudId,
      tipoDocumento: TIPO_DOCUMENTO,
      activo: true,
    },
    orderBy: { version: 'desc' },
    include: {
      generadoPor: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export function toDocumentoResponse(
  documento: CompraDocumento,
  solicitudId: string
) {
  return formatDocumentoMetadata(documento, solicitudId);
}

export async function readDocumentoBuffer(
  documento: Pick<CompraDocumento, 'storagePath' | 'url'>
): Promise<Buffer> {
  const storage = getStorage();
  if (storage.driverName === 'local') {
    const absolutePath = path.join(process.cwd(), 'public', documento.storagePath);
    return readFile(absolutePath);
  }

  const url = await storage.getUrl(documento.storagePath);
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo leer el documento desde el almacenamiento');
  return Buffer.from(await response.arrayBuffer());
}

export async function solicitudTieneErrorDocumento(solicitudId: string): Promise<boolean> {
  const record = await prisma.auditRecord.findFirst({
    where: {
      entityId: solicitudId,
      module: 'COMPRAS',
      category: COMPRA_AUDIT.DOCUMENTO_ERROR,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return Boolean(record);
}
