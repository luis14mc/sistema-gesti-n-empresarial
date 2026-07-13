import { readFile } from 'fs/promises';
import path from 'path';
import type { CompraSolicitud, CompraSolicitudItem, Proveedor } from '@prisma/client';
import {
  COMPRA_ESTADO_LABELS,
  COMPRA_FORMA_PAGO_LABELS,
  COMPRA_PRIORIDAD_LABELS,
  COMPRA_TIPO_LABELS,
  COMPRA_UNIDAD_LABELS,
} from './constants';
import { getInstitutionConfig } from './institution';

export type SolicitudPdfData = CompraSolicitud & {
  items: CompraSolicitudItem[];
  proveedor?: Proveedor | null;
  departamentoSolicitante?: { name: string } | null;
  centroCosto?: { code: string; name: string } | null;
  solicitadoPor?: { firstName: string; lastName: string } | null;
  autorizadoPor?: { firstName: string; lastName: string } | null;
  aprobadoPor?: { firstName: string; lastName: string } | null;
  emitidoPor?: { firstName: string; lastName: string } | null;
};

function fmtDate(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('es-HN');
}

function fmtMoney(value: number): string {
  return `L. ${value.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signatureBlock(
  user?: { firstName: string; lastName: string } | null,
  signedAt?: Date | string | null
): { name: string; date: string } {
  if (!user) {
    return { name: 'Pendiente', date: '________________________' };
  }
  return {
    name: fullName(user),
    date: signedAt ? fmtDate(signedAt) : '________________________',
  };
}

const PROVEEDOR_PENDIENTE = 'Proveedor pendiente de asignar';

function fullName(user?: { firstName: string; lastName: string } | null): string {
  if (!user) return '—';
  return `${user.firstName} ${user.lastName}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceAll(template: string, key: string, value: string): string {
  return template.replaceAll(`{{${key}}}`, value);
}

export function validateSolicitudForPdf(solicitud: SolicitudPdfData): string | null {
  if (!solicitud.codigoSolicitud) return 'Código de solicitud requerido';
  if (!solicitud.fechaSolicitud) return 'Fecha de solicitud requerida';
  if (!solicitud.solicitadoPor) return 'Solicitante requerido';
  if (!solicitud.departamentoSolicitante?.name) return 'Departamento solicitante requerido';
  if (!solicitud.items?.length) return 'Debe incluir al menos un ítem';

  for (const item of solicitud.items) {
    if (item.cantidad <= 0) return 'Cantidad inválida en ítems';
    if (item.precioUnitario < 0) return 'Precio unitario inválido en ítems';
  }

  if (solicitud.subtotal < 0 || solicitud.total < 0) return 'Totales inválidos';
  return null;
}

export async function construirHtmlSolicitudCompra(
  solicitud: SolicitudPdfData,
  options?: { version?: number }
): Promise<string> {
  const validationError = validateSolicitudForPdf(solicitud);
  if (validationError) throw new Error(validationError);

  const templatePath = path.join(
    process.cwd(),
    'src/templates/compras/solicitud-orden-compra.html'
  );
  let template = await readFile(templatePath, 'utf8');
  const institution = await getInstitutionConfig();

  const itemsRows = solicitud.items
    .map(
      (item) => `
      <tr>
        <td>${item.item}</td>
        <td>${escapeHtml(item.codigo ?? '—')}</td>
        <td>${escapeHtml(item.descripcion)}</td>
        <td>${COMPRA_UNIDAD_LABELS[item.unidad]}</td>
        <td style="text-align:right">${item.cantidad}</td>
        <td style="text-align:right">${fmtMoney(item.precioUnitario)}</td>
        <td style="text-align:right">${fmtMoney(item.total)}</td>
      </tr>`
    )
    .join('');

  const proveedor = solicitud.proveedor;
  const firmaSolicitante = signatureBlock(solicitud.solicitadoPor, solicitud.fechaSolicitud);
  const firmaAutorizador = signatureBlock(solicitud.autorizadoPor, solicitud.autorizadoEn);
  const firmaAprobador = signatureBlock(solicitud.aprobadoPor, solicitud.aprobadoEn);
  const firmaEmisor = signatureBlock(solicitud.emitidoPor, solicitud.emitidoEn);

  const replacements: Record<string, string> = {
    LOGO_URL: institution.logoUrl,
    INSTITUCION_NOMBRE: escapeHtml(institution.name),
    CODIGO_SOLICITUD: escapeHtml(solicitud.codigoSolicitud),
    ESTADO: escapeHtml(COMPRA_ESTADO_LABELS[solicitud.estado]),
    FECHA_EMISION: fmtDate(new Date()),
    DEPARTAMENTO: escapeHtml(solicitud.departamentoSolicitante?.name ?? '—'),
    CENTRO_COSTO: escapeHtml(
      solicitud.centroCosto ? `${solicitud.centroCosto.code} - ${solicitud.centroCosto.name}` : '—'
    ),
    SOLICITANTE: escapeHtml(fullName(solicitud.solicitadoPor)),
    CARGO: escapeHtml(solicitud.cargoSolicitante ?? '—'),
    FECHA_SOLICITUD: fmtDate(solicitud.fechaSolicitud),
    FECHA_REQUERIDA: fmtDate(solicitud.fechaRequerida),
    TIPO_COMPRA: escapeHtml(COMPRA_TIPO_LABELS[solicitud.tipoCompra]),
    PRIORIDAD: escapeHtml(COMPRA_PRIORIDAD_LABELS[solicitud.prioridad]),
    PROVEEDOR_NOMBRE: escapeHtml(proveedor?.nombreRazonSocial ?? PROVEEDOR_PENDIENTE),
    PROVEEDOR_RTN: escapeHtml(proveedor?.rtn ?? '—'),
    PROVEEDOR_TELEFONO: escapeHtml(proveedor?.telefono ?? '—'),
    PROVEEDOR_EMAIL: escapeHtml(proveedor?.email ?? '—'),
    PROVEEDOR_CONTACTO: escapeHtml(proveedor?.personaContacto ?? '—'),
    PROVEEDOR_DIRECCION: escapeHtml(proveedor?.direccion ?? '—'),
    ITEMS_ROWS: itemsRows,
    SUBTOTAL: fmtMoney(solicitud.subtotal),
    DESCUENTO: fmtMoney(solicitud.descuento),
    IMPUESTO: fmtMoney(solicitud.impuesto),
    TOTAL: fmtMoney(solicitud.total),
    JUSTIFICACION: escapeHtml(solicitud.justificacionCompra),
    CONDICIONES_ENTREGA: escapeHtml(solicitud.condicionesEntrega ?? '—'),
    FORMA_PAGO: escapeHtml(COMPRA_FORMA_PAGO_LABELS[solicitud.formaPago]),
    PLAZO_PAGO: solicitud.plazoPagoDias ? `${solicitud.plazoPagoDias} días` : '—',
    DETALLES_PAGO: escapeHtml(solicitud.detallesPago ?? '—'),
    OBSERVACIONES: escapeHtml(solicitud.observacionesAdicionales ?? '—'),
    FIRMA_SOLICITANTE: escapeHtml(firmaSolicitante.name),
    FIRMA_SOLICITANTE_FECHA: escapeHtml(firmaSolicitante.date),
    FIRMA_AUTORIZADOR: escapeHtml(firmaAutorizador.name),
    FIRMA_AUTORIZADOR_FECHA: escapeHtml(firmaAutorizador.date),
    FIRMA_APROBADOR: escapeHtml(firmaAprobador.name),
    FIRMA_APROBADOR_FECHA: escapeHtml(firmaAprobador.date),
    FIRMA_EMISOR: escapeHtml(firmaEmisor.name),
    FIRMA_EMISOR_FECHA: escapeHtml(firmaEmisor.date),
    VERSION: String(options?.version ?? 1),
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = replaceAll(template, key, value);
  }

  return template;
}

/** Compatibilidad con endpoint HTML previo */
export async function buildCompraPdfHtml(
  solicitud: SolicitudPdfData,
  options?: { version?: number }
): Promise<string> {
  return construirHtmlSolicitudCompra(solicitud, options);
}
