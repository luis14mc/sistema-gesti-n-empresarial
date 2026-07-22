/**
 * Tipos frontend — módulo Orden de Compra institucional.
 */

import type {
  CompraAdjunto as PrismaCompraAdjunto,
  CompraEstado,
  CompraUnidad,
  CompraSolicitud as PrismaCompraSolicitud,
} from '@prisma/client';

export type { CompraEstado, CompraUnidad };

export interface CompraUserRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CompraSolicitanteRef extends CompraUserRef {
  email?: string;
  position?: { name: string } | null;
}

export interface Proveedor {
  id: string;
  nombreRazonSocial: string;
  rtn?: string | null;
  telefono?: string | null;
  email?: string | null;
  personaContacto?: string | null;
  direccion?: string | null;
  activo?: boolean;
}

export type CompraSolicitudItem = {
  id: string;
  solicitudCompraId: string;
  item: number;
  descripcion: string;
  unidad: CompraUnidad;
  cantidad: number;
  precioUnitario: number;
  total: number;
};

export type CompraAdjunto = Omit<PrismaCompraAdjunto, 'uploadedBy' | 'solicitud'> & {
  uploadedBy?: CompraUserRef | null;
};

export interface CompraDocumento {
  id: string;
  url: string;
  nombreArchivo: string;
  storagePath: string;
  version: number;
  generadoEn?: string | Date;
  generadoPor?: CompraUserRef | null;
}

export type CompraSolicitud = Omit<
  PrismaCompraSolicitud,
  'items' | 'adjuntos' | 'documentos' | 'solicitadoPor' | 'proveedor'
> & {
  solicitadoPor?: CompraSolicitanteRef | null;
  proveedor?: Proveedor | null;
  items: CompraSolicitudItem[];
  adjuntos: CompraAdjunto[];
  documentos?: CompraDocumento[];
};

export interface CompraSolicitudFilters {
  estado?: CompraEstado;
  search?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateCompraSolicitudItemData {
  item?: number;
  descripcion: string;
  unidad: CompraUnidad;
  cantidad: number;
  precioUnitario?: number;
}

export interface CreateCompraSolicitudData {
  fechaSolicitud?: string;
  fechaRequerida?: string;
  referenciaCompra?: string;
  cargoSolicitante?: string;
  proveedorId?: string | null;
  proveedorNombre?: string;
  proveedorIdentificacion?: string | null;
  proveedorTelefono?: string | null;
  proveedorEmail?: string | null;
  proveedorContacto?: string | null;
  proveedorDireccion?: string | null;
  justificacionCompra?: string;
  observacionesAdicionales?: string;
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
