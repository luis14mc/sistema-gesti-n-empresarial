import { api, apiHelpers } from '@/utils/api';
import type {
  CompraSolicitud,
  CompraSolicitudFilters,
  CreateCompraSolicitudData,
  UpdateCompraSolicitudData,
  Proveedor,
  CreateProveedorData,
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

  generarOrden: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/generar-orden`, {}),

  emitir: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/emitir`, {}),

  regenerarPdf: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/regenerar-pdf`, {}),

  cerrar: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/cerrar`, {}),

  anular: (id: string) =>
    apiHelpers.post<{ solicitud: CompraSolicitud }>(`${BASE}/solicitudes/${id}/anular`, {}),

  getVistaPreviaUrl: (id: string) => `${BASE}/solicitudes/${id}/vista-previa`,
  getImprimirUrl: (id: string) => `${BASE}/solicitudes/${id}/imprimir`,

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

  listProveedores: (search?: string) =>
    apiHelpers.get<{ proveedores: Proveedor[] }>(`${BASE}/proveedores`, { search, activo: 'true' }),

  createProveedor: (data: CreateProveedorData) =>
    apiHelpers.post<{ proveedor: Proveedor }>(`${BASE}/proveedores`, data),

  getInstitution: () =>
    apiHelpers.get<{
      settings: {
        name: string;
        address: string;
        phone: string;
        website: string;
        logoPath: string;
      };
      logoUrl: string;
    }>(`${BASE}/institucion`),

  updateInstitution: (data: {
    name: string;
    address: string;
    phone: string;
    website: string;
  }) => apiHelpers.put<{
    settings: {
      name: string;
      address: string;
      phone: string;
      website: string;
      logoPath: string;
    };
    logoUrl: string;
  }>(`${BASE}/institucion`, data),

  uploadInstitutionLogo: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{
      settings: {
        name: string;
        address: string;
        phone: string;
        website: string;
        logoPath: string;
      };
      logoUrl: string;
    }>(`${BASE}/institucion/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getReportes: (year: number) =>
    apiHelpers.get<{
      year: number;
      porEstado: Array<{ estado: CompraSolicitud['estado']; _count: { _all: number }; _sum: { total: number | null } }>;
      montoPorMes: Array<{ mes: number; total: number; cantidad: number }>;
      ordenesEmitidas: number;
      enProceso: number;
      cerradas: number;
      anuladas: number;
    }>(`${BASE}/reportes`, { year }),
};
