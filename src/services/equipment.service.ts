// ============================================
// Servicio de Equipos IT
// Endpoints: /api/equipment/*
// ============================================

import { api, apiHelpers } from '@/utils/api';
import type {
  Equipment,
  EquipmentFilters,
  CreateEquipmentData,
  UpdateEquipmentData,
  EquipmentMaintenance,
  CreateMaintenanceData,
  UpdateMaintenanceData,
  EquipmentStats,
} from '@/types';

const BASE = '/api/equipment';

/** Forma de la respuesta GET /api/equipment */
export interface EquipmentListResponse {
  success: true;
  data: {
    items: Equipment[];
    meta: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
  requestId: string;
}

/** Forma de la respuesta POST/PATCH /api/equipment */
export interface EquipmentResponse {
  equipment: Equipment;
}

/** Forma de la respuesta para mantenimientos */
export interface MaintenanceResponse {
  maintenance: EquipmentMaintenance;
}

export interface EquipmentImportError {
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface EquipmentImportResponse {
  success: true;
  data: {
    totalRows: number;
    imported: number;
    skipped: number;
    errors: EquipmentImportError[];
  };
  requestId: string;
}

export const equipmentService = {
  /** Listar equipos con filtros opcionales (status, type) */
  list: (filters?: EquipmentFilters) =>
    apiHelpers.get<EquipmentListResponse>(BASE, filters as Record<string, unknown>),

  /** Obtener equipo por ID (incluye asignaciones activas y mantenimientos) */
  getById: (id: string) =>
    apiHelpers.get<EquipmentResponse>(`${BASE}/${id}`),

  /** Crear nuevo equipo */
  create: (data: CreateEquipmentData) =>
    apiHelpers.post<EquipmentResponse>(BASE, data),

  importExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<EquipmentImportResponse>(`${BASE}/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
  },

  /** Actualizar equipo existente */
  update: (id: string, data: UpdateEquipmentData) =>
    apiHelpers.patch<EquipmentResponse>(`${BASE}/${id}`, data),

  /** Eliminar equipo */
  delete: (id: string) =>
    apiHelpers.delete(`${BASE}/${id}`),

  /** Estadísticas del módulo de equipos */
  stats: () =>
    apiHelpers.get<{ stats: EquipmentStats }>(`${BASE}/stats`),

  // --- Mantenimientos ---

  /** Registrar mantenimiento para un equipo */
  addMaintenance: (data: CreateMaintenanceData) =>
    apiHelpers.post<MaintenanceResponse>('/api/maintenance', data),

  /** Actualizar mantenimiento existente */
  updateMaintenance: (maintenanceId: string, data: UpdateMaintenanceData) =>
    apiHelpers.patch<MaintenanceResponse>(`/api/maintenance/${maintenanceId}`, data),
};
