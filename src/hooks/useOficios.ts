'use client';

// ============================================
// HOOK useOficios - React Query
// ============================================
// Queries y mutaciones para oficios:
//   - Listar con filtros (type, status), CRUD completo
//   - Numeración automática en backend

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { oficiosService } from '@/services/oficios.service';
import type {
    OficioFilters,
    CreateOficioData,
    UpdateOficioData,
} from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const oficioKeys = {
    all: ['oficios'] as const,
    lists: () => [...oficioKeys.all, 'list'] as const,
    list: (filters?: OficioFilters) => [...oficioKeys.lists(), filters] as const,
    detail: (id: string) => [...oficioKeys.all, 'detail', id] as const,
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useOficios(filters?: OficioFilters) {
    const queryClient = useQueryClient();

    const oficiosQuery = useQuery({
        queryKey: oficioKeys.list(filters),
        queryFn: async () => {
            const response = await oficiosService.list(filters);
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: CreateOficioData) => {
            const response = await oficiosService.create(data);
            return response.data.oficio;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateOficioData }) => {
            const response = await oficiosService.update(id, data);
            return response.data.oficio;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
            queryClient.invalidateQueries({ queryKey: oficioKeys.detail(variables.id) });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await oficiosService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
        },
    });

    return {
        oficios: oficiosQuery.data?.oficios ?? [],
        total: oficiosQuery.data?.total ?? 0,
        page: oficiosQuery.data?.page ?? 1,
        pageSize: oficiosQuery.data?.pageSize ?? 10,
        totalPages: oficiosQuery.data?.totalPages ?? 1,
        isLoading: oficiosQuery.isLoading,
        isError: oficiosQuery.isError,
        error: oficiosQuery.error,

        createOficio: createMutation.mutateAsync,
        isCreating: createMutation.isPending,

        updateOficio: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deleteOficio: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        refetch: oficiosQuery.refetch,
    };
}

// ============================================
// HOOK DETALLE — Oficio por ID
// ============================================

export function useOficioDetail(id: string | null) {
    const queryClient = useQueryClient();

    const detailQuery = useQuery({
        queryKey: oficioKeys.detail(id ?? ''),
        queryFn: async () => {
            const response = await oficiosService.getById(id!);
            return response.data.oficio;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: async (data: UpdateOficioData) => {
            const response = await oficiosService.update(id!, data);
            return response.data.oficio;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.detail(id!) });
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            await oficiosService.delete(id!);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: oficioKeys.lists() });
        },
    });

    return {
        oficio: detailQuery.data ?? null,
        isLoading: detailQuery.isLoading,
        isError: detailQuery.isError,

        updateOficio: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deleteOficio: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        refetch: detailQuery.refetch,
    };
}
