// ============================================
// Servicio de Marcado de Reloj / Asistencia
// Endpoints: /api/time-entries/*
// ============================================

import { apiHelpers } from '@/utils/api';
import type {
  TimeEntry,
  TimeEntryFilters,
  CreateTimeEntryData,
} from '@/types';

const BASE = '/api/time-entries';

/** Forma de la respuesta GET /api/time-entries */
export interface TimeEntriesListResponse {
  timeEntries: TimeEntry[];
}

/** Forma de la respuesta POST /api/time-entries */
export interface TimeEntryResponse {
  timeEntry: TimeEntry;
}

export const timeEntriesService = {
  /** Listar entradas de tiempo con filtros (userId, startDate, endDate) */
  list: (filters?: TimeEntryFilters) =>
    apiHelpers.get<TimeEntriesListResponse>(BASE, filters as Record<string, unknown>),

  /** Registrar entrada/salida/pausa */
  create: (data: CreateTimeEntryData) =>
    apiHelpers.post<TimeEntryResponse>(BASE, data),
};
