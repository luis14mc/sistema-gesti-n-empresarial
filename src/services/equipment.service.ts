// ============================================
// Servicio de Equipos IT
// Endpoints: /api/equipment/*
// ============================================

import { apiHelpers } from '@/utils/api';
import type {
  Equipment,
  EquipmentFilters,
  CreateEquipmentData,
  UpdateEquipmentData,
  EquipmentMaintenance,
  CreateMaintenanceData,
  UpdateMaintenanceData,
} from '@/types';

const BASE = '/api/equipment';

/** Forma de la respuesta GET /api/equipment */
export interface EquipmentListResponse {
  equipment: Equipment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Forma de la respuesta POST/PATCH /api/equipment */
export interface EquipmentResponse {
  equipment: Equipment;
}

/** Forma de la respuesta para mantenimientos */
export interface MaintenanceResponse {
  maintenance: EquipmentMaintenance;
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

  /** Actualizar equipo existente */
  update: (id: string, data: UpdateEquipmentData) =>
    apiHelpers.patch<EquipmentResponse>(`${BASE}/${id}`, data),

  /** Eliminar equipo */
  delete: (id: string) =>
    apiHelpers.delete(`${BASE}/${id}`),

  // --- Mantenimientos ---

  /** Registrar mantenimiento para un equipo */
  addMaintenance: (equipmentId: string, data: CreateMaintenanceData) =>
    apiHelpers.post<MaintenanceResponse>(
      `${BASE}/${equipmentId}/maintenances`,
      data
    ),

  /** Actualizar mantenimiento existente */
  updateMaintenance: (
    equipmentId: string,
    maintenanceId: string,
    data: UpdateMaintenanceData
  ) =>
    apiHelpers.patch<MaintenanceResponse>(
      `${BASE}/${equipmentId}/maintenances/${maintenanceId}`,
      data
    ),
};
