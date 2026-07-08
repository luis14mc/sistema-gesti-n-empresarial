'use client';

// ============================================
// HOOK usePromotionalItems - React Query
// ============================================
// Queries y mutaciones para inventario promocional:
//   - Listar, CRUD, registrar movimientos

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promotionalItemsService } from '@/services/promotional-items.service';
import type {
    PromotionalItemFilters,
    CreatePromotionalItemData,
    UpdatePromotionalItemData,
    CreatePromotionalMovementData,
} from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const promotionalKeys = {
    all: ['promotionalItems'] as const,
    lists: () => [...promotionalKeys.all, 'list'] as const,
    list: (filters?: PromotionalItemFilters) => [...promotionalKeys.lists(), filters] as const,
    detail: (id: string) => [...promotionalKeys.all, 'detail', id] as const,
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function usePromotionalItems(filters?: PromotionalItemFilters) {
    const queryClient = useQueryClient();

    const itemsQuery = useQuery({
        queryKey: promotionalKeys.list(filters),
        queryFn: async () => {
            const response = await promotionalItemsService.list(filters);
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: CreatePromotionalItemData) => {
            const response = await promotionalItemsService.create(data);
            return response.data.item;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promotionalKeys.lists() });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdatePromotionalItemData }) => {
            const response = await promotionalItemsService.update(id, data);
            return response.data.item;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: promotionalKeys.lists() });
            queryClient.invalidateQueries({ queryKey: promotionalKeys.detail(variables.id) });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await promotionalItemsService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promotionalKeys.lists() });
        },
    });

    const addMovementMutation = useMutation({
        mutationFn: async ({ itemId, data }: { itemId: string; data: CreatePromotionalMovementData }) => {
            const response = await promotionalItemsService.addMovement(itemId, data);
            return response.data.movement;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: promotionalKeys.detail(variables.itemId) });
            queryClient.invalidateQueries({ queryKey: promotionalKeys.lists() });
        },
    });

    return {
        items: itemsQuery.data?.items ?? [],
        total: itemsQuery.data?.total ?? 0,
        page: itemsQuery.data?.page ?? 1,
        pageSize: itemsQuery.data?.pageSize ?? 10,
        totalPages: itemsQuery.data?.totalPages ?? 1,
        isLoading: itemsQuery.isLoading,
        isError: itemsQuery.isError,
        error: itemsQuery.error,

        createItem: createMutation.mutateAsync,
        isCreating: createMutation.isPending,

        updateItem: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deleteItem: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        addMovement: addMovementMutation.mutateAsync,
        isAddingMovement: addMovementMutation.isPending,

        refetch: itemsQuery.refetch,
    };
}

// ============================================
// HOOK DETALLE — Artículo por ID
// ============================================

export function usePromotionalItemDetail(id: string | null) {
    const queryClient = useQueryClient();

    const detailQuery = useQuery({
        queryKey: promotionalKeys.detail(id ?? ''),
        queryFn: async () => {
            const response = await promotionalItemsService.getById(id!);
            return response.data.item;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: async (data: UpdatePromotionalItemData) => {
            const response = await promotionalItemsService.update(id!, data);
            return response.data.item;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promotionalKeys.detail(id!) });
            queryClient.invalidateQueries({ queryKey: promotionalKeys.lists() });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            await promotionalItemsService.delete(id!);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promotionalKeys.lists() });
        },
    });

    const addMovementMutation = useMutation({
        mutationFn: async (data: CreatePromotionalMovementData) => {
            const response = await promotionalItemsService.addMovement(id!, data);
            return response.data.movement;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promotionalKeys.detail(id!) });
            queryClient.invalidateQueries({ queryKey: promotionalKeys.lists() });
        },
    });

    return {
        item: detailQuery.data ?? null,
        isLoading: detailQuery.isLoading,
        isError: detailQuery.isError,

        updateItem: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deleteItem: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        addMovement: addMovementMutation.mutateAsync,
        isAddingMovement: addMovementMutation.isPending,

        refetch: detailQuery.refetch,
    };
}
