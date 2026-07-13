// ============================================
// Servicio de Asignación de Equipos
// Endpoints: /api/equipment-assignments/*
// ============================================

import { apiHelpers } from '@/utils/api';
import type {
  EquipmentAssignment,
  AssignmentFilters,
  CreateAssignmentData,
  ReturnAssignmentData,
  SwapEquipmentData,
} from '@/types';

const BASE = '/api/equipment-assignments';

/** Forma de la respuesta GET /api/equipment-assignments */
export interface AssignmentsListResponse {
  assignments: EquipmentAssignment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Forma de la respuesta POST/PATCH /api/equipment-assignments */
export interface AssignmentResponse {
  assignment: EquipmentAssignment;
}

export const equipmentAssignmentsService = {
  /** Listar asignaciones con filtros (userId, equipmentId, status) */
  list: (filters?: AssignmentFilters) =>
    apiHelpers.get<AssignmentsListResponse>(
      BASE,
      filters as Record<string, unknown>
    ),

  /** Obtener asignación por ID */
  getById: (id: string) =>
    apiHelpers.get<AssignmentResponse>(`${BASE}/${id}`),

  /** Crear nueva asignación de equipo a usuario */
  create: (data: CreateAssignmentData) =>
    apiHelpers.post<AssignmentResponse>(BASE, data),

  /** Registrar devolución de equipo */
  return: (id: string, data: ReturnAssignmentData) =>
    apiHelpers.patch<AssignmentResponse>(`${BASE}/${id}/return`, data),

  /** Adjuntar documento a asignación */
  attachDocument: (id: string, documentType: 'delivery' | 'return', documentUrl: string) =>
    apiHelpers.patch<AssignmentResponse>(`${BASE}/${id}/document`, { documentType, documentUrl }),

  /** Cambio de equipo (devolución + nueva asignación) */
  swap: (data: SwapEquipmentData) =>
    apiHelpers.post<{ closedAssignment: EquipmentAssignment; newAssignment: EquipmentAssignment }>(
      `${BASE}/swap`,
      data
    ),
};