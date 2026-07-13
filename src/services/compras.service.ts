import { api, apiHelpers } from '@/utils/api';
import type {
  CompraSolicitud,
  CompraSolicitudFilters,
  CreateCompraSolicitudData,
  UpdateCompraSolicitudData,
  Proveedor,
  CreateProveedorData,
  CompraReportes,
  CostCenter,
  CompraDocumento,
  CompraDocumentoEstado,
  CompraDocumentoMetadata,
} from '@/types/compras';

const BASE = '/api/compras';

export const comprasService = {
  listSolicitudes: (filters?: CompraSolicitudFilters) =>
    apiHelpers.get<{
      solicitudes: CompraSolicitud[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`${BASE}/solicitudes`, filters as Record<string, unknown>),

  getSolicitud: (id: string) =>
    apiHelpers.get<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}`),

  createSolicitud: (data: CreateCompraSolicitudData) =>
    apiHelpers.post<{
      success: boolean;
      data: { solicitud: CompraSolicitud; documento: CompraDocumentoMetadata | null };
      warning?: string;
    }>(`${BASE}/solicitudes`, data),

  updateSolicitud: (id: string, data: UpdateCompraSolicitudData) =>
    apiHelpers.patch<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}`, data),

  enviar: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/enviar`, {}),

  autorizar: (id: string, body?: { motivoRechazo?: string }) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/autorizar`, body ?? {}),

  rechazar: (id: string, body: { motivoRechazo: string }) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/rechazar`, body),

  aprobar: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/aprobar`, {}),

  emitirOrden: (id: string, body?: { proveedorId?: string }) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/emitir-orden`, body ?? {}),

  cerrar: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/cerrar`, {}),

  uploadAdjunto: (id: string, file: File, tipoAdjunto: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipoAdjunto', tipoAdjunto);
    return api.post<{ adjunto: CompraSolicitud['adjuntos'][number] }>(
      `${BASE}/solicitudes/${id}/adjuntos`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  pdfUrl: (id: string) => `${BASE}/solicitudes/${id}/pdf`,

  documentoUrl: (id: string, download = false) =>
    `${BASE}/solicitudes/${id}/documento/descargar${download ? '?download=1' : ''}`,

  getDocumento: (id: string) =>
    apiHelpers.get<{
      documento: CompraDocumentoMetadata | null;
      documentoEstado: CompraDocumentoEstado;
    }>(`${BASE}/solicitudes/${id}/documento`),

  regenerarDocumento: (id: string) =>
    apiHelpers.post<{ success: boolean; data: { documento: CompraDocumentoMetadata } }>(
      `${BASE}/solicitudes/${id}/documento/regenerar`,
      {}
    ),

  listProveedores: (search?: string) =>
    apiHelpers.get<{ proveedores: Proveedor[] }>(`${BASE}/proveedores`, { search, activo: 'true' }),

  createProveedor: (data: CreateProveedorData) =>
    apiHelpers.post<{ proveedor: Proveedor }>(`${BASE}/proveedores`, data),

  listCentrosCosto: () =>
    apiHelpers.get<{ centros: CostCenter[] }>(`${BASE}/centros-costo`),

  reportes: (year?: number) =>
    apiHelpers.get<CompraReportes>(`${BASE}/reportes`, { year }),
};
