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
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes`, data),

  updateSolicitud: (id: string, data: UpdateCompraSolicitudData) =>
    apiHelpers.patch<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}`, data),

  enviar: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/enviar`, {}),

  autorizar: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/autorizar`, {}),

  aprobar: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/aprobar`, {}),

  rechazar: (id: string, body: { motivoRechazo: string }) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/rechazar`, body),

  emitirOrden: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/emitir-orden`, {}),

  recibir: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/recibir`, {}),

  cerrar: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/cerrar`, {}),

  anular: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/anular`, {}),

  getImprimirUrl: (id: string) => `${BASE}/solicitudes/${id}/imprimir`,

  uploadAdjunto: (id: string, file: File, tipo: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    return api.post<{ adjunto: CompraSolicitud['adjuntos'][number] }>(
      `${BASE}/solicitudes/${id}/adjuntos`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  listProveedores: (search?: string) =>
    apiHelpers.get<{ proveedores: Proveedor[] }>(`${BASE}/proveedores`, { search, activo: 'true' }),

  createProveedor: (data: CreateProveedorData) =>
    apiHelpers.post<{ proveedor: Proveedor }>(`${BASE}/proveedores`, data),

  listCentrosCosto: () =>
    apiHelpers.get<{ centros: CostCenter[] }>(`${BASE}/centros-costo`),

  reportes: (year?: number) =>
    apiHelpers.get<CompraReportes>(`${BASE}/reportes`, { year }),
};
