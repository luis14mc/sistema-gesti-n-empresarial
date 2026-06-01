'use client';

// ============================================
// HOOK usePurchases - React Query
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesService } from '@/services/purchases.service';
import type {
    PurchaseFilters,
    CreatePurchaseData,
    UpdatePurchaseData,
    CreatePurchaseItemData,
} from '@/types';

export const purchaseKeys = {
    all: ['purchases'] as const,
    lists: () => [...purchaseKeys.all, 'list'] as const,
    list: (filters?: PurchaseFilters) => [...purchaseKeys.lists(), filters] as const,
    detail: (id: string) => [...purchaseKeys.all, 'detail', id] as const,
};

export function usePurchases(filters?: PurchaseFilters) {
    const queryClient = useQueryClient();

    const purchasesQuery = useQuery({
        queryKey: purchaseKeys.list(filters),
        queryFn: async () => {
            const response = await purchasesService.list(filters);
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: CreatePurchaseData) => {
            const response = await purchasesService.create(data);
            return response.data.purchase;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdatePurchaseData }) => {
            const response = await purchasesService.update(id, data);
            return response.data.purchase;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
            queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(variables.id) });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await purchasesService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
        },
    });

    return {
        purchases: purchasesQuery.data?.purchases ?? [],
        total: purchasesQuery.data?.total ?? 0,
        page: purchasesQuery.data?.page ?? 1,
        pageSize: purchasesQuery.data?.pageSize ?? 10,
        totalPages: purchasesQuery.data?.totalPages ?? 1,
        isLoading: purchasesQuery.isLoading,
        isError: purchasesQuery.isError,
        error: purchasesQuery.error,

        createPurchase: createMutation.mutateAsync,
        isCreating: createMutation.isPending,

        updatePurchase: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deletePurchase: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        refetch: purchasesQuery.refetch,
    };
}

// ============================================
// HOOK DETALLE — Solicitud por ID
// ============================================

export function usePurchaseDetail(id: string | null) {
    const queryClient = useQueryClient();

    const detailQuery = useQuery({
        queryKey: purchaseKeys.detail(id ?? ''),
        queryFn: async () => {
            const response = await purchasesService.getById(id!);
            return response.data.purchase;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: async (data: UpdatePurchaseData) => {
            const response = await purchasesService.update(id!, data);
            return response.data.purchase;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(id!) });
            queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            await purchasesService.delete(id!);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() });
        },
    });

    const addItemMutation = useMutation({
        mutationFn: async (data: CreatePurchaseItemData) => {
            const response = await purchasesService.addItem(id!, data);
            return response.data.item;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(id!) });
        },
    });

    const deleteItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            await purchasesService.deleteItem(id!, itemId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: purchaseKeys.detail(id!) });
        },
    });

    return {
        purchase: detailQuery.data ?? null,
        isLoading: detailQuery.isLoading,
        isError: detailQuery.isError,

        updatePurchase: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deletePurchase: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        addItem: addItemMutation.mutateAsync,
        isAddingItem: addItemMutation.isPending,

        deleteItem: deleteItemMutation.mutateAsync,
        isDeletingItem: deleteItemMutation.isPending,

        refetch: detailQuery.refetch,
    };
}
