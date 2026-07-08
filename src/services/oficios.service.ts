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

export const oficiosService = {
  /** Listar oficios con filtros opcionales (type, status) */
  list: (filters?: OficioFilters) =>
    apiHelpers.get<OficiosListResponse>(BASE, filters as Record<string, unknown>),

  /** Obtener oficio por ID */
  getById: (id: string) =>
    apiHelpers.get<OficioResponse>(`${BASE}/${id}`),

  /** Crear nuevo oficio (numeración automática en backend) */
  create: (data: CreateOficioData) =>
    apiHelpers.post<OficioResponse>(BASE, data),

  /** Actualizar oficio existente */
  update: (id: string, data: UpdateOficioData) =>
    apiHelpers.patch<OficioResponse>(`${BASE}/${id}`, data),

  /** Eliminar oficio */
  delete: (id: string) =>
    apiHelpers.delete(`${BASE}/${id}`),
};
