import { api, apiHelpers } from '@/utils/api';
import type {
  CompraOrden,
  CompraOrdenFilters,
  CompraOrdenHistorialEntry,
  CompraOrdenDocumento,
  CreateCompraOrdenData,
  UpdateCompraOrdenData,
} from '@/types/compra-orden';

const BASE = '/api/compras/ordenes';

export const compraOrdenService = {
  list: (filters?: CompraOrdenFilters) =>
    apiHelpers.get<{
      ordenes: CompraOrden[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(BASE, filters as Record<string, unknown>),

  get: (id: string) => apiHelpers.get<{ orden: CompraOrden }>(`${BASE}/${id}`),

  create: (data: CreateCompraOrdenData) =>
    apiHelpers.post<{ orden: CompraOrden }>(BASE, data),

  update: (id: string, data: UpdateCompraOrdenData) =>
    apiHelpers.patch<{ orden: CompraOrden }>(`${BASE}/${id}`, data),

  generar: (id: string) => apiHelpers.post<{ orden: CompraOrden }>(`${BASE}/${id}/generar`, {}),
  validar: (id: string) =>
    api.post<{ orden: CompraOrden }>(`${BASE}/${id}/validar`, {}, { timeout: 120_000 }),
  emitir: (id: string) => apiHelpers.post<{ orden: CompraOrden }>(`${BASE}/${id}/emitir`, {}),
  anular: (id: string, motivoAnulacion: string) =>
    apiHelpers.post<{ orden: CompraOrden }>(`${BASE}/${id}/anular`, { motivoAnulacion }),
  cerrar: (id: string) => apiHelpers.post<{ orden: CompraOrden }>(`${BASE}/${id}/cerrar`, {}),
  regenerarPdf: (id: string) =>
    apiHelpers.post<{ orden: CompraOrden }>(`${BASE}/${id}/regenerar-pdf`, {}),

  delete: (id: string) => apiHelpers.delete(`${BASE}/${id}`),

  getPdfPreviewUrl: (id: string) => `${BASE}/${id}/pdf`,
  previewDraft: (data: CreateCompraOrdenData) =>
    fetch(`${BASE}/preview`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  getActiveTemplate: () =>
    apiHelpers.get<{ template: import('@/lib/compras/orden/template-config').PurchaseOrderTemplateConfig }>(
      '/api/compras/configuracion/plantilla-activa'
    ),
  getDocumentos: (orderId: string) =>
    apiHelpers.get<{ documents: CompraOrdenDocumento[] }>(`${BASE}/${orderId}/documentos`),
  getDocumentViewUrl: (orderId: string, documentId: string) =>
    `${BASE}/${orderId}/documentos/${documentId}/view`,
  getDocumentDownloadUrl: (orderId: string, documentId: string) =>
    `${BASE}/${orderId}/documentos/${documentId}/download`,
  getHistorial: (id: string) =>
    apiHelpers.get<{ historial: CompraOrdenHistorialEntry[] }>(`${BASE}/${id}/historial`),

  uploadDocumento: (id: string, file: File, tipo: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    return api.post(`${BASE}/${id}/documentos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteDocumento: (orderId: string, documentId: string) =>
    apiHelpers.delete(`${BASE}/${orderId}/documentos/${documentId}`),

  getTemplate: () => apiHelpers.get<{ template: unknown }>('/api/compras/template'),
  saveTemplate: (data: unknown) => apiHelpers.put<{ template: unknown }>('/api/compras/template', data),
};
