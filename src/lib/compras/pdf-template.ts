import { readFile } from 'fs/promises';
import path from 'path';
import type { CompraSolicitud, CompraSolicitudItem, Proveedor } from '@prisma/client';
import {
  COMPRA_ESTADO_LABELS,
  COMPRA_FORMA_PAGO_LABELS,
  COMPRA_NOTA_IMPORTANTE,
  COMPRA_PRIORIDAD_LABELS,
  COMPRA_TIPO_LABELS,
  COMPRA_UNIDAD_LABELS,
} from './constants';
import { getInstitutionConfig } from './institution';

type SolicitudPdfData = CompraSolicitud & {
  items: CompraSolicitudItem[];
  departamentoSolicitante?: { name: string } | null;
  centroCosto?: { code: string; name: string } | null;
  solicitadoPor?: { firstName: string; lastName: string } | null;
  proveedor?: Proveedor | null;
  autorizadoPor?: { firstName: string; lastName: string } | null;
  aprobadoPor?: { firstName: string; lastName: string } | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(value: number): string {
  return `L ${value.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-HN');
}

function formatUser(user?: { firstName: string; lastName: string } | null, date?: Date | null): string {
  if (!user) return 'Pendiente';
  const name = `${user.firstName} ${user.lastName}`;
  return date ? `${name}<br/>${formatDate(date)}` : name;
}

export async function construirHtmlSolicitudCompra(
  solicitud: SolicitudPdfData,
  version = 1
): Promise<string> {
  const templatePath = path.join(process.cwd(), 'src/templates/compras/solicitud-orden-compra.html');
  let html = await readFile(templatePath, 'utf-8');
  const { name: institutionName, logoUrl } = await getInstitutionConfig();

  const proveedorNombre =
    solicitud.proveedorNombre ?? solicitud.proveedor?.nombreRazonSocial ?? '—';
  const proveedorRtn =
    solicitud.proveedorIdentificacion ?? solicitud.proveedor?.rtn ?? '—';

  const itemsRows = solicitud.items
    .map(
      (item) => `<tr>
        <td>${item.item}</td>
        <td>${escapeHtml(item.codigo ?? '')}</td>
        <td>${escapeHtml(item.descripcion)}</td>
        <td>${COMPRA_UNIDAD_LABELS[item.unidad]}</td>
        <td style="text-align:right">${item.cantidad}</td>
        <td style="text-align:right">${formatMoney(item.precioUnitario)}</td>
        <td style="text-align:right">${formatMoney(item.total)}</td>
      </tr>`
    )
    .join('');

  const replacements: Record<string, string> = {
    LOGO_URL: logoUrl,
    INSTITUCION_NOMBRE: escapeHtml(institutionName),
    CODIGO_SOLICITUD: escapeHtml(solicitud.numero),
    ESTADO: escapeHtml(COMPRA_ESTADO_LABELS[solicitud.estado]),
    FECHA_EMISION: formatDate(new Date()),
    DEPARTAMENTO: escapeHtml(solicitud.departamentoSolicitante?.name ?? '—'),
    CENTRO_COSTO: escapeHtml(
      solicitud.centroCosto ? `${solicitud.centroCosto.code} - ${solicitud.centroCosto.name}` : '—'
    ),
    SOLICITANTE: escapeHtml(
      solicitud.solicitadoPor
        ? `${solicitud.solicitadoPor.firstName} ${solicitud.solicitadoPor.lastName}`
        : '—'
    ),
    CARGO: escapeHtml(solicitud.cargoSolicitante ?? '—'),
    FECHA_SOLICITUD: formatDate(solicitud.fechaSolicitud),
    FECHA_REQUERIDA: formatDate(solicitud.fechaRequerida),
    TIPO_COMPRA: escapeHtml(COMPRA_TIPO_LABELS[solicitud.tipoCompra]),
    PRIORIDAD: escapeHtml(COMPRA_PRIORIDAD_LABELS[solicitud.prioridad]),
    PROVEEDOR_NOMBRE: escapeHtml(proveedorNombre),
    PROVEEDOR_RTN: escapeHtml(proveedorRtn),
    PROVEEDOR_TELEFONO: escapeHtml(solicitud.proveedorTelefono ?? solicitud.proveedor?.telefono ?? '—'),
    PROVEEDOR_EMAIL: escapeHtml(solicitud.proveedorEmail ?? solicitud.proveedor?.email ?? '—'),
    PROVEEDOR_CONTACTO: escapeHtml(solicitud.proveedorContacto ?? solicitud.proveedor?.personaContacto ?? '—'),
    PROVEEDOR_DIRECCION: escapeHtml(solicitud.proveedorDireccion ?? solicitud.proveedor?.direccion ?? '—'),
    ITEMS_ROWS: itemsRows,
    SUBTOTAL: formatMoney(solicitud.subtotal),
    DESCUENTO: formatMoney(solicitud.descuento),
    IMPUESTO: formatMoney(solicitud.impuesto),
    TOTAL: formatMoney(solicitud.total),
    JUSTIFICACION: escapeHtml(solicitud.justificacionCompra),
    CONDICIONES_ENTREGA: escapeHtml(solicitud.condicionesEntrega ?? '—'),
    FORMA_PAGO: escapeHtml(COMPRA_FORMA_PAGO_LABELS[solicitud.formaPago]),
    PLAZO_PAGO: solicitud.plazoPagoDias ? `${solicitud.plazoPagoDias} días` : '—',
    DETALLES_PAGO: escapeHtml(solicitud.detallesPago ?? '—'),
    OBSERVACIONES: escapeHtml(solicitud.observacionesAdicionales ?? '—'),
    NOTA_IMPORTANTE: escapeHtml(COMPRA_NOTA_IMPORTANTE).replace(/\n/g, '<br/>'),
    FIRMA_SOLICITANTE: formatUser(solicitud.solicitadoPor, solicitud.fechaSolicitud),
    FIRMA_AUTORIZADOR: formatUser(solicitud.autorizadoPor, solicitud.autorizadoEn),
    FIRMA_APROBADOR: formatUser(solicitud.aprobadoPor, solicitud.aprobadoEn),
    FIRMA_EMISOR: solicitud.emitidoEn ? formatDate(solicitud.emitidoEn) : 'Pendiente',
    VERSION: String(version),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  return html;
}
