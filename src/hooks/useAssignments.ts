'use client';

// ============================================
// HOOK useAssignments - React Query
// ============================================
// Queries y mutaciones para asignaciones de equipos:
//   - Listar, crear asignación, registrar devolución

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { equipmentAssignmentsService } from '@/services/equipment-assignments.service';
import { equipmentKeys } from './useEquipment';
import type {
    AssignmentFilters,
    CreateAssignmentData,
    ReturnAssignmentData,
    SwapEquipmentData,
} from '@/types';
import type { AssignmentDetailResponse } from '@/services/equipment-assignments.service';

// ============================================
// QUERY KEYS
// ============================================

export const assignmentKeys = {
    all: ['assignments'] as const,
    lists: () => [...assignmentKeys.all, 'list'] as const,
    list: (filters?: AssignmentFilters) => [...assignmentKeys.lists(), filters] as const,
    detail: (id: string) => [...assignmentKeys.all, 'detail', id] as const,
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useAssignments(filters?: AssignmentFilters, options?: { enabled?: boolean }) {
    const queryClient = useQueryClient();

    // --- Lista de asignaciones ---
    const assignmentsQuery = useQuery({
        queryKey: assignmentKeys.list(filters),
        enabled: options?.enabled !== false,
        queryFn: async () => {
            const response = await equipmentAssignmentsService.list(filters);
            return response.data;
        },
    });

    // --- Crear asignación ---
    const createMutation = useMutation({
        mutationFn: async (data: CreateAssignmentData) => {
            const response = await equipmentAssignmentsService.create(data);
            return response.data.assignment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            // También invalidar equipos (cambia el estado de asignación)
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
        },
    });

    // --- Registrar devolución ---
    const returnMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: ReturnAssignmentData }) => {
            const response = await equipmentAssignmentsService.return(id, data);
            return response.data.assignment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.stats() });
        },
    });

    const swapMutation = useMutation({
        mutationFn: async (data: SwapEquipmentData) => {
            const response = await equipmentAssignmentsService.swap(data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.stats() });
        },
    });

    const regenerateActaMutation = useMutation({
        mutationFn: async ({ id, type }: { id: string; type: 'delivery' | 'return' }) => {
            const response = await equipmentAssignmentsService.regenerateActa(id, type);
            return response.data.assignment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
        },
    });

    const attachDocumentMutation = useMutation({
        mutationFn: async ({
            id,
            documentType,
            documentUrl,
        }: {
            id: string;
            documentType: 'delivery' | 'return';
            documentUrl: string;
        }) => {
            const response = await equipmentAssignmentsService.attachDocument(id, documentType, documentUrl);
            return response.data.assignment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: assignmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
        },
    });

    return {
        // --- Datos ---
        assignments: assignmentsQuery.data?.assignments ?? [],
        summary: assignmentsQuery.data?.summary,
        total: assignmentsQuery.data?.total ?? 0,
        page: assignmentsQuery.data?.page ?? 1,
        pageSize: assignmentsQuery.data?.pageSize ?? 10,
        totalPages: assignmentsQuery.data?.totalPages ?? 1,
        isLoading: assignmentsQuery.isLoading,
        isFetching: assignmentsQuery.isFetching,
        isError: assignmentsQuery.isError,
        isForbidden:
            assignmentsQuery.isError &&
            (assignmentsQuery.error as { response?: { status?: number } })?.response?.status === 403,
        error: assignmentsQuery.error,

        // --- Mutaciones ---
        createAssignment: createMutation.mutate,
        isCreating: createMutation.isPending,

        returnAssignment: returnMutation.mutate,
        isReturning: returnMutation.isPending,

        swapEquipment: swapMutation.mutateAsync,
        isSwapping: swapMutation.isPending,

        attachDocument: attachDocumentMutation.mutateAsync,
        isAttachingDocument: attachDocumentMutation.isPending,

        regenerateActa: regenerateActaMutation.mutateAsync,
        isRegeneratingActa: regenerateActaMutation.isPending,

        // --- Refetch manual ---
        refetch: assignmentsQuery.refetch,
    };
}

export function useAssignmentDetail(assignmentId: string | null) {
    return useQuery({
        queryKey: assignmentKeys.detail(assignmentId ?? ''),
        enabled: Boolean(assignmentId),
        queryFn: async () => {
            const response = await equipmentAssignmentsService.getById(assignmentId!);
            return response.data as AssignmentDetailResponse;
        },
    });
}