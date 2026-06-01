// ============================================
// Servicio de Inventario Promocional
// Endpoints: /api/promotional-items/*
// ============================================

import { apiHelpers } from '@/utils/api';
import type {
  PromotionalItem,
  PromotionalItemFilters,
  CreatePromotionalItemData,
  UpdatePromotionalItemData,
  PromotionalMovement,
  CreatePromotionalMovementData,
} from '@/types';

const BASE = '/api/promotional-items';

/** Forma de la respuesta GET /api/promotional-items */
export interface PromotionalItemsListResponse {
  items: PromotionalItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Forma de la respuesta POST/PATCH /api/promotional-items */
export interface PromotionalItemResponse {
  item: PromotionalItem;
}

/** Forma de la respuesta POST /api/promotional-items/:id/movements */
export interface MovementResponse {
  movement: PromotionalMovement;
}

export const promotionalItemsService = {
  /** Listar artículos promocionales con filtros */
  list: (filters?: PromotionalItemFilters) =>
    apiHelpers.get<PromotionalItemsListResponse>(BASE, filters as Record<string, unknown>),

  /** Obtener artículo por ID (incluye últimos 5 movimientos) */
  getById: (id: string) =>
    apiHelpers.get<PromotionalItemResponse>(`${BASE}/${id}`),

  /** Crear artículo promocional */
  create: (data: CreatePromotionalItemData) =>
    apiHelpers.post<PromotionalItemResponse>(BASE, data),

  /** Actualizar artículo */
  update: (id: string, data: UpdatePromotionalItemData) =>
    apiHelpers.patch<PromotionalItemResponse>(`${BASE}/${id}`, data),

  /** Eliminar artículo */
  delete: (id: string) =>
    apiHelpers.delete(`${BASE}/${id}`),

  /** Registrar movimiento (salida, retorno, ajuste) */
  addMovement: (itemId: string, data: CreatePromotionalMovementData) =>
    apiHelpers.post<MovementResponse>(`${BASE}/${itemId}/movements`, data),
};
