// ============================================
// Servicio de Tickets de Soporte
// Endpoints: /api/tickets/*
// ============================================

import { apiHelpers } from '@/utils/api';
import type {
  Ticket,
  TicketFilters,
  CreateTicketData,
  UpdateTicketData,
  TicketComment,
  CreateCommentData,
} from '@/types';

const BASE = '/api/tickets';

/** Forma de la respuesta GET /api/tickets */
export interface TicketsListResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Forma de la respuesta POST/PATCH /api/tickets */
export interface TicketResponse {
  ticket: Ticket;
}

/** Forma de la respuesta POST /api/tickets/:id/comments */
export interface CommentResponse {
  comment: TicketComment;
}

export const ticketsService = {
  /** Listar tickets con filtros opcionales */
  list: (filters?: TicketFilters) =>
    apiHelpers.get<TicketsListResponse>(BASE, filters as Record<string, unknown>),

  /** Obtener ticket por ID (incluye creador, asignado y comentarios) */
  getById: (id: string) =>
    apiHelpers.get<TicketResponse>(`${BASE}/${id}`),

  /** Crear nuevo ticket */
  create: (data: CreateTicketData) =>
    apiHelpers.post<TicketResponse>(BASE, data),

  /** Actualizar ticket existente */
  update: (id: string, data: UpdateTicketData) =>
    apiHelpers.patch<TicketResponse>(`${BASE}/${id}`, data),

  /** Eliminar ticket */
  delete: (id: string) =>
    apiHelpers.delete(`${BASE}/${id}`),

  /** Agregar comentario a un ticket */
  addComment: (ticketId: string, data: CreateCommentData) =>
    apiHelpers.post<CommentResponse>(`${BASE}/${ticketId}/comments`, data),
};
