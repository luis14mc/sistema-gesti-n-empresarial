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
} from '@/types';

const BASE = '/api/equipment-assignments';

/** Forma de la respuesta GET /api/equipment-assignments */
export interface AssignmentsListResponse {
  assignments: EquipmentAssignment[];
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
};
