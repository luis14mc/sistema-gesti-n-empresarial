// ============================================
// Servicio de Compras / Adquisiciones
// Endpoints: /api/purchases/*
// ============================================

import { apiHelpers } from '@/utils/api';
import type {
    PurchaseRequest,
    PurchaseItem,
    PurchaseFilters,
    CreatePurchaseData,
    UpdatePurchaseData,
    CreatePurchaseItemData,
} from '@/types';

const BASE = '/api/purchases';

export interface PurchaseListResponse {
    purchases: PurchaseRequest[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface PurchaseResponse {
    purchase: PurchaseRequest;
}

export interface PurchaseItemResponse {
    item: PurchaseItem;
}

export const purchasesService = {
    /** Listar solicitudes de compra con filtros opcionales */
    list: (filters?: PurchaseFilters) =>
        apiHelpers.get<PurchaseListResponse>(BASE, filters as Record<string, unknown>),

    /** Obtener solicitud por ID (incluye items y relaciones) */
    getById: (id: string) =>
        apiHelpers.get<PurchaseResponse>(`${BASE}/${id}`),

    /** Crear nueva solicitud de compra */
    create: (data: CreatePurchaseData) =>
        apiHelpers.post<PurchaseResponse>(BASE, data),

    /** Actualizar solicitud existente */
    update: (id: string, data: UpdatePurchaseData) =>
        apiHelpers.patch<PurchaseResponse>(`${BASE}/${id}`, data),

    /** Eliminar solicitud */
    delete: (id: string) =>
        apiHelpers.delete(`${BASE}/${id}`),

    // --- Items ---

    /** Agregar item a una solicitud */
    addItem: (purchaseId: string, data: CreatePurchaseItemData) =>
        apiHelpers.post<PurchaseItemResponse>(`${BASE}/${purchaseId}/items`, data),

    /** Eliminar item de una solicitud */
    deleteItem: (purchaseId: string, itemId: string) =>
        apiHelpers.delete(`${BASE}/${purchaseId}/items/${itemId}`),
};
