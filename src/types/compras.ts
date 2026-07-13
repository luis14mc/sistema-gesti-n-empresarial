import type {
  CompraEstado,
  CompraFormaPago,
  CompraPrioridad,
  CompraTipo,
  CompraTipoAdjunto,
  CompraUnidad,
} from '@prisma/client';

export interface CompraSolicitudItem {
  id?: string;
  item: number;
  codigo?: string | null;
  descripcion: string;
  unidad: CompraUnidad;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

export interface CompraDocumentoMetadata {
  id: string;
  nombreArchivo: string;
  tipoDocumento: 'solicitud_orden_compra_pdf';
  version: number;
  activo: boolean;
  mimeType: string;
  generadoEn: string;
  urlDescarga: string;
  urlVer: string;
}

export type CompraDocumentoEstado = 'generado' | 'pendiente' | 'error';

export interface CompraDocumento {
  id: string;
  solicitudCompraId: string;
  tipoDocumento: 'ORDEN_COMPRA_PDF' | 'solicitud_orden_compra_pdf';
  nombreArchivo: string;
  mimeType: string;
  storagePath?: string;
  url?: string;
  version: number;
  activo: boolean;
  generadoEn: string;
  generadoPor?: { id: string; firstName: string; lastName: string };
  urlDescarga?: string;
  urlVer?: string;
}

export interface CompraAdjunto {
  id: string;
  tipoAdjunto: CompraTipoAdjunto;
  nombre: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy?: { id: string; firstName: string; lastName: string };
}

export interface Proveedor {
  id: string;
  nombreRazonSocial: string;
  rtn?: string | null;
  telefono?: string | null;
  email?: string | null;
  personaContacto?: string | null;
  direccion?: string | null;
  activo: boolean;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface CompraSolicitud {
  id: string;
  codigoSolicitud: string;
  fechaSolicitud: string;
  fechaRequerida: string;
  departamentoSolicitanteId: string;
  centroCostoId: string;
  solicitadoPorId: string;
  cargoSolicitante?: string | null;
  tipoCompra: CompraTipo;
  prioridad: CompraPrioridad;
  estado: CompraEstado;
  proveedorId?: string | null;
  justificacionCompra: string;
  condicionesEntrega?: string | null;
  observacionesAdicionales?: string | null;
  formaPago: CompraFormaPago;
  plazoPagoDias?: number | null;
  detallesPago?: string | null;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  motivoRechazo?: string | null;
  autorizadoEn?: string | null;
  aprobadoEn?: string | null;
  emitidoEn?: string | null;
  departamentoSolicitante?: { id: string; name: string };
  centroCosto?: CostCenter;
  solicitadoPor?: { id: string; firstName: string; lastName: string; email?: string };
  proveedor?: Proveedor | null;
  autorizadoPor?: { id: string; firstName: string; lastName: string } | null;
  aprobadoPor?: { id: string; firstName: string; lastName: string } | null;
  emitidoPor?: { id: string; firstName: string; lastName: string } | null;
  items: CompraSolicitudItem[];
  adjuntos: CompraAdjunto[];
  documentos?: CompraDocumento[];
  documentoEstado?: CompraDocumentoEstado;
}

export interface CompraSolicitudFilters {
  estado?: CompraEstado;
  prioridad?: CompraPrioridad;
  tipoCompra?: CompraTipo;
  departamentoId?: string;
  centroCostoId?: string;
  proveedorId?: string;
  search?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateCompraSolicitudData {
  fechaSolicitud?: string;
  fechaRequerida: string;
  departamentoSolicitanteId: string;
  centroCostoId: string;
  cargoSolicitante?: string;
  tipoCompra: CompraTipo;
  prioridad?: CompraPrioridad;
  proveedorId?: string | null;
  justificacionCompra: string;
  condicionesEntrega?: string;
  observacionesAdicionales?: string;
  formaPago: CompraFormaPago;
  plazoPagoDias?: number | null;
  detallesPago?: string;
  descuento?: number;
  items: Array<{
    item?: number;
    codigo?: string;
    descripcion: string;
    unidad: CompraUnidad;
    cantidad: number;
    precioUnitario: number;
  }>;
}

export type UpdateCompraSolicitudData = Partial<CreateCompraSolicitudData>;

export interface CreateProveedorData {
  nombreRazonSocial: string;
  rtn?: string | null;
  telefono?: string | null;
  email?: string | null;
  personaContacto?: string | null;
  direccion?: string | null;
}

export interface CompraReportes {
  year: number;
  porEstado: Array<{ estado: CompraEstado; _count: { _all: number }; _sum: { total: number | null } }>;
  porProveedor: Array<{ proveedorId: string | null; proveedor: string; _count: { _all: number }; _sum: { total: number | null } }>;
  porDepartamento: Array<{ departamentoSolicitanteId: string; departamento: string; _count: { _all: number }; _sum: { total: number | null } }>;
  porCentroCosto: Array<{ centroCostoId: string; centroCosto: string; _count: { _all: number }; _sum: { total: number | null } }>;
  porPrioridad: Array<{ prioridad: CompraPrioridad; _count: { _all: number }; _sum: { total: number | null } }>;
  montoPorMes: Array<{ mes: number; total: number; cantidad: number }>;
  ordenesEmitidas: number;
  ordenesPendientes: number;
  cerradas: number;
}
