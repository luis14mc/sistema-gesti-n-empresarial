'use client';

// ============================================
// HOOK useTickets - React Query
// ============================================
// Expone queries y mutaciones para el módulo de tickets:
//   - Listar con filtros, CRUD, comentarios
//   - Invalidación automática de caché tras mutaciones

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsService } from '@/services/tickets.service';
import type {
    TicketFilters,
    CreateTicketData,
    UpdateTicketData,
    CreateCommentData,
} from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const ticketKeys = {
    all: ['tickets'] as const,
    lists: () => [...ticketKeys.all, 'list'] as const,
    list: (filters?: TicketFilters) => [...ticketKeys.lists(), filters] as const,
    detail: (id: string) => [...ticketKeys.all, 'detail', id] as const,
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useTickets(filters?: TicketFilters) {
    const queryClient = useQueryClient();

    // --- Lista de tickets ---
    const ticketsQuery = useQuery({
        queryKey: ticketKeys.list(filters),
        queryFn: async () => {
            const response = await ticketsService.list(filters);
            return response.data;
        },
    });

    // --- Crear ticket ---
    const createMutation = useMutation({
        mutationFn: async (data: CreateTicketData) => {
            const response = await ticketsService.create(data);
            return response.data.ticket;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
        },
    });

    // --- Actualizar ticket ---
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateTicketData }) => {
            const response = await ticketsService.update(id, data);
            return response.data.ticket;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(variables.id) });
        },
    });

    // --- Eliminar ticket ---
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await ticketsService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
        },
    });

    // --- Agregar comentario ---
    const addCommentMutation = useMutation({
        mutationFn: async ({ ticketId, data }: { ticketId: string; data: CreateCommentData }) => {
            const response = await ticketsService.addComment(ticketId, data);
            return response.data.comment;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(variables.ticketId) });
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
        },
    });

    return {
        // --- Datos ---
        tickets: ticketsQuery.data?.tickets ?? [],
        total: ticketsQuery.data?.total ?? 0,
        page: ticketsQuery.data?.page ?? 1,
        pageSize: ticketsQuery.data?.pageSize ?? 10,
        totalPages: ticketsQuery.data?.totalPages ?? 1,
        isLoading: ticketsQuery.isLoading,
        isError: ticketsQuery.isError,
        error: ticketsQuery.error,

        // --- Mutaciones ---
        createTicket: createMutation.mutateAsync,
        isCreating: createMutation.isPending,

        updateTicket: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deleteTicket: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        addComment: addCommentMutation.mutateAsync,
        isAddingComment: addCommentMutation.isPending,

        // --- Refetch manual ---
        refetch: ticketsQuery.refetch,
    };
}

// ============================================
// HOOK DETALLE — Ticket por ID
// ============================================

export function useTicketDetail(id: string | null) {
    const queryClient = useQueryClient();

    const detailQuery = useQuery({
        queryKey: ticketKeys.detail(id ?? ''),
        queryFn: async () => {
            const response = await ticketsService.getById(id!);
            return response.data.ticket;
        },
        enabled: !!id,
    });

    // --- Actualizar ticket (desde detalle) ---
    const updateMutation = useMutation({
        mutationFn: async (data: UpdateTicketData) => {
            const response = await ticketsService.update(id!, data);
            return response.data.ticket;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id!) });
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
        },
    });

    // --- Eliminar ticket ---
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await ticketsService.delete(id!);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
        },
    });

    // --- Agregar comentario ---
    const addCommentMutation = useMutation({
        mutationFn: async (data: CreateCommentData) => {
            const response = await ticketsService.addComment(id!, data);
            return response.data.comment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id!) });
        },
    });

    return {
        ticket: detailQuery.data ?? null,
        isLoading: detailQuery.isLoading,
        isError: detailQuery.isError,

        updateTicket: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deleteTicket: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        addComment: addCommentMutation.mutateAsync,
        isAddingComment: addCommentMutation.isPending,

        refetch: detailQuery.refetch,
    };
}
