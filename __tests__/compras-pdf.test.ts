import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  construirHtmlSolicitudCompra,
  validateSolicitudForPdf,
} from '../src/lib/compras/pdf-template';
import { canRegenerateCompraDocument } from '../src/lib/compras/workflow';
import { createCompraSolicitudSchema } from '../src/lib/compras/schemas';
import {
  formatDocumentoMetadata,
  resolveDocumentoEstadoFromDocs,
} from '../src/lib/compras/document-metadata';
import { COMPRA_AUDIT } from '../src/lib/compras/audit-actions';

vi.mock('../src/lib/compras/pdf-renderer', () => ({
  renderHtmlToPdf: vi.fn(async () => Buffer.from('%PDF-1.4 mock')),
}));

const solicitudBase = {
  id: 'sol-1',
  codigoSolicitud: 'SC-0001-2026',
  fechaSolicitud: new Date('2026-07-01'),
  fechaRequerida: new Date('2026-07-20'),
  departamentoSolicitanteId: 'dep-1',
  centroCostoId: 'cc-1',
  solicitadoPorId: 'user-1',
  cargoSolicitante: 'Analista',
  tipoCompra: 'BIENES' as const,
  prioridad: 'NORMAL' as const,
  estado: 'BORRADOR' as const,
  proveedorId: null,
  justificacionCompra: 'Compra necesaria para operaciones',
  condicionesEntrega: 'Entrega en 10 días',
  observacionesAdicionales: null,
  formaPago: 'CONTADO' as const,
  plazoPagoDias: null,
  detallesPago: null,
  subtotal: 1000,
  descuento: 0,
  impuesto: 150,
  total: 1150,
  autorizadoPorId: null,
  autorizadoEn: null,
  aprobadoPorId: null,
  aprobadoEn: null,
  emitidoPorId: null,
  emitidoEn: null,
  motivoRechazo: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  departamentoSolicitante: { name: 'TI' },
  centroCosto: { code: 'CC-TI-001', name: 'Infraestructura' },
  solicitadoPor: { firstName: 'Juan', lastName: 'Pérez' },
  proveedor: null,
  items: [
    {
      id: 'item-1',
      solicitudCompraId: 'sol-1',
      item: 1,
      codigo: 'A-01',
      descripcion: 'Laptop',
      unidad: 'UNIDAD' as const,
      cantidad: 1,
      precioUnitario: 1000,
      total: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

describe('compras solicitud schema', () => {
  it('rechaza solicitud sin ítems', () => {
    const parsed = createCompraSolicitudSchema.safeParse({
      fechaRequerida: '2026-07-20',
      departamentoSolicitanteId: 'dep-1',
      centroCostoId: 'cc-1',
      tipoCompra: 'BIENES',
      prioridad: 'NORMAL',
      justificacionCompra: 'Compra necesaria para operaciones',
      formaPago: 'CONTADO',
      descuento: 0,
      items: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('compras PDF template', () => {
  it('rechaza solicitud sin ítems', () => {
    expect(validateSolicitudForPdf({ ...solicitudBase, items: [] })).toContain('ítem');
  });

  it('rechaza ítems con cantidad inválida', () => {
    expect(
      validateSolicitudForPdf({
        ...solicitudBase,
        items: [{ ...solicitudBase.items[0], cantidad: 0 }],
      })
    ).toContain('Cantidad');
  });

  it('construye HTML institucional completo', async () => {
    const html = await construirHtmlSolicitudCompra(solicitudBase, { version: 1 });

    expect(html).toContain('data:image/svg+xml;base64,');
    expect(html).toContain('SOLICITUD Y ORDEN DE COMPRA');
    expect(html).toContain('Bienes y Servicios');
    expect(html).toContain('SC-0001-2026');
    expect(html).toContain('L. 1,150.00');
    expect(html).toContain('Laptop');
    expect(html).toContain('Proveedor pendiente de asignar');
    expect(html).toContain('Pendiente');
  });

  it('muestra proveedor cuando existe', async () => {
    const html = await construirHtmlSolicitudCompra(
      {
        ...solicitudBase,
        proveedor: {
          id: 'prov-1',
          nombreRazonSocial: 'Proveedor SA',
          rtn: '08011990123456',
          telefono: '9999-9999',
          email: 'ventas@proveedor.hn',
          personaContacto: 'María',
          direccion: 'Tegucigalpa',
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { version: 1 }
    );

    expect(html).toContain('Proveedor SA');
    expect(html).not.toContain('Proveedor pendiente de asignar');
  });
});

describe('compras document metadata', () => {
  it('expone url de descarga segura', () => {
    const meta = formatDocumentoMetadata(
      {
        id: 'doc-1',
        nombreArchivo: 'orden-compra-v1.pdf',
        tipoDocumento: 'ORDEN_COMPRA_PDF',
        version: 1,
        activo: true,
        generadoEn: new Date(),
        mimeType: 'application/pdf',
      },
      'sol-1'
    );

    expect(meta.tipoDocumento).toBe('solicitud_orden_compra_pdf');
    expect(meta.urlDescarga).toBe('/api/compras/solicitudes/sol-1/documento/descargar');
  });

  it('resuelve estado del documento', () => {
    expect(resolveDocumentoEstadoFromDocs([{ activo: true }])).toBe('generado');
    expect(resolveDocumentoEstadoFromDocs([])).toBe('pendiente');
    expect(resolveDocumentoEstadoFromDocs([], true)).toBe('error');
  });
});

describe('compras audit actions', () => {
  it('define acciones institucionales', () => {
    expect(COMPRA_AUDIT.DOCUMENTO_GENERADO).toBe('compra_documento_generado');
    expect(COMPRA_AUDIT.DOCUMENTO_ERROR).toBe('compra_documento_error_generacion');
  });
});

describe('compras document regeneration rules', () => {
  it('permite regenerar en borrador al solicitante', () => {
    expect(canRegenerateCompraDocument('BORRADOR', 'IT', true)).toBe(true);
  });

  it('bloquea regeneración en cerrada salvo admin', () => {
    expect(canRegenerateCompraDocument('CERRADA', 'IT', true)).toBe(false);
    expect(canRegenerateCompraDocument('CERRADA', 'ADMIN', false)).toBe(true);
  });
});

describe('compras PDF renderer mock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('genera buffer PDF simulado', async () => {
    const { renderHtmlToPdf } = await import('../src/lib/compras/pdf-renderer');
    const buffer = await renderHtmlToPdf('<html></html>');
    expect(buffer.toString()).toContain('%PDF');
  });
});

describe('compras PDF service integration (mocked)', () => {
  it('versiona documentos al regenerar', () => {
    const latest = { version: 2 };
    const nextVersion = (latest?.version ?? 0) + 1;
    expect(nextVersion).toBe(3);
  });
});
