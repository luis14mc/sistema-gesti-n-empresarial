// ============================================
// Servicio de Oficios
// Endpoints: /api/oficios/*
// ============================================

import { apiHelpers } from '@/utils/api';
import type {
  Oficio,
  OficioFilters,
  CreateOficioData,
  UpdateOficioData,
} from '@/types';

const BASE = '/api/oficios';

/** Forma de la respuesta GET /api/oficios */
export interface OficiosListResponse {
  oficios: Oficio[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Forma de la respuesta POST/PATCH /api/oficios */
export interface OficioResponse {
  oficio: Oficio;
}

export interface OficioSearchFilters {
  q?: string;
  scope?: string;
  status?: string;
  type?: string;
  recordSource?: string;
  hasDocument?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const oficiosService = {
  /** Listar oficios con filtros (scope, direction, status, search) */
  list: (filters?: OficioFilters) =>
    apiHelpers.get<OficiosListResponse>(BASE, filters as Record<string, unknown>),

  /** Búsqueda global con filtros extendidos (para /oficios/todos) */
  search: (filters?: OficioSearchFilters) =>
    apiHelpers.get<OficiosListResponse>(`${BASE}/search`, filters as Record<string, unknown>),

  /** Obtener oficio por ID */
  getById: (id: string) =>
    apiHelpers.get<OficioResponse>(`${BASE}/${id}`),

  /** Crear nuevo oficio (numeración automática en backend) */
  create: (data: CreateOficioData) =>
    apiHelpers.post<OficioResponse>(BASE, data),

  /** Importar oficio histórico (carga individual con archivo) */
  importIndividual: (formData: FormData) =>
    apiHelpers.postForm<{ oficio: Oficio; duplicates: unknown[]; warnings: string[] }>(
      `${BASE}/import`,
      formData,
    ),

  /** Actualizar oficio existente */
  update: (id: string, data: UpdateOficioData) =>
    apiHelpers.patch<OficioResponse>(`${BASE}/${id}`, data),

  /** Cambiar estado */
  updateStatus: (id: string, status: string) =>
    apiHelpers.patch<OficioResponse>(`${BASE}/${id}/status`, { status }),

  /** Agregar documento adicional */
  addDocument: (id: string, formData: FormData) =>
    apiHelpers.postForm<{ document: unknown }>(`${BASE}/${id}/documents`, formData),

  /** Eliminar oficio */
  delete: (id: string) =>
    apiHelpers.delete(`${BASE}/${id}`),
};
