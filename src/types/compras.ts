/**
 * Tipos frontend — módulo Compras (ficha Solicitud y Orden de Compra).
 */

import type {
  CompraEstado,
  CompraFormaPago,
  CompraPrioridad,
  CompraTipo,
  CompraUnidad,
} from '@prisma/client';

export type { CompraEstado, CompraFormaPago, CompraPrioridad, CompraTipo, CompraUnidad };

export interface CompraUserRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CompraSolicitanteRef extends CompraUserRef {
  email?: string;
  departmentId?: string;
  position?: { name: string } | null;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string | null;
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

export interface CompraSolicitudItem {
  id: string;
  solicitudCompraId: string;
  item: number;
  codigo?: string | null;
  descripcion: string;
  unidad: CompraUnidad;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

export interface CompraAdjunto {
  id: string;
  solicitudCompraId: string;
  tipo: string;
  nombre: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy?: CompraUserRef;
}

export interface CompraSolicitud {
  id: string;
  numero: string;
  fechaSolicitud: string;
  fechaRequerida?: string | null;
  departamentoSolicitanteId?: string | null;
  centroCostoId?: string | null;
  solicitadoPorId: string;
  cargoSolicitante?: string | null;
  tipoCompra: CompraTipo;
  prioridad: CompraPrioridad;
  estado: CompraEstado;
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  proveedorIdentificacion?: string | null;
  proveedorTelefono?: string | null;
  proveedorEmail?: string | null;
  proveedorContacto?: string | null;
  proveedorDireccion?: string | null;
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
  autorizadoPorId?: string | null;
  autorizadoEn?: string | null;
  aprobadoPorId?: string | null;
  aprobadoEn?: string | null;
  rechazadoPorId?: string | null;
  rechazadoEn?: string | null;
  motivoRechazo?: string | null;
  emitidoPorId?: string | null;
  emitidoEn?: string | null;
  documentoPdfUrl?: string | null;
  solicitadoPor?: CompraSolicitanteRef;
  departamentoSolicitante?: { id: string; name: string } | null;
  centroCosto?: CostCenter | null;
  proveedor?: Proveedor | null;
  autorizadoPor?: CompraUserRef | null;
  aprobadoPor?: CompraUserRef | null;
  rechazadoPor?: CompraUserRef | null;
  items: CompraSolicitudItem[];
  adjuntos: CompraAdjunto[];
}

export interface CompraSolicitudFilters {
  estado?: CompraEstado;
  prioridad?: CompraPrioridad;
  tipo?: CompraTipo;
  departamentoId?: string;
  search?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateCompraSolicitudItemData {
  item?: number;
  codigo?: string;
  descripcion: string;
  unidad: CompraUnidad;
  cantidad: number;
  precioUnitario?: number;
}

export interface CreateCompraSolicitudData {
  fechaSolicitud?: string;
  fechaRequerida?: string;
  departamentoSolicitanteId?: string;
  centroCostoId?: string;
  cargoSolicitante?: string;
  tipoCompra?: CompraTipo;
  prioridad?: CompraPrioridad;
  proveedorId?: string | null;
  proveedorNombre?: string;
  proveedorIdentificacion?: string | null;
  proveedorTelefono?: string | null;
  proveedorEmail?: string | null;
  proveedorContacto?: string | null;
  proveedorDireccion?: string | null;
  justificacionCompra?: string;
  condicionesEntrega?: string;
  observacionesAdicionales?: string;
  formaPago?: CompraFormaPago;
  plazoPagoDias?: number | null;
  detallesPago?: string;
  descuento?: number;
  items?: CreateCompraSolicitudItemData[];
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
  porDepartamento: Array<{ departamentoSolicitanteId: string | null; departamento: string; _count: { _all: number }; _sum: { total: number | null } }>;
  porCentroCosto: Array<{ centroCostoId: string | null; centroCosto: string; _count: { _all: number }; _sum: { total: number | null } }>;
  porPrioridad: Array<{ prioridad: CompraPrioridad; _count: { _all: number }; _sum: { total: number | null } }>;
  montoPorMes: Array<{ mes: number; total: number; cantidad: number }>;
  ordenesEmitidas: number;
  pendientesAprobacion: number;
  cerradas: number;
}
