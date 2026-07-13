'use client';

// ============================================
// HOOK useEquipment - React Query
// ============================================
// Queries y mutaciones para equipos IT:
//   - Listar con filtros, CRUD, mantenimientos

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { equipmentService } from '@/services/equipment.service';
import type {
    EquipmentFilters,
    CreateEquipmentData,
    UpdateEquipmentData,
    CreateMaintenanceData,
    EquipmentStats,
} from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const equipmentKeys = {
    all: ['equipment'] as const,
    lists: () => [...equipmentKeys.all, 'list'] as const,
    list: (filters?: EquipmentFilters) => [...equipmentKeys.lists(), filters] as const,
    detail: (id: string) => [...equipmentKeys.all, 'detail', id] as const,
    stats: () => [...equipmentKeys.all, 'stats'] as const,
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useEquipment(filters?: EquipmentFilters) {
    const queryClient = useQueryClient();

    const equipmentQuery = useQuery({
        queryKey: equipmentKeys.list(filters),
        queryFn: async () => {
            const response = await equipmentService.list(filters);
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: CreateEquipmentData) => {
            const response = await equipmentService.create(data);
            return response.data.equipment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateEquipmentData }) => {
            const response = await equipmentService.update(id, data);
            return response.data.equipment;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.detail(variables.id) });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await equipmentService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
        },
    });

    const addMaintenanceMutation = useMutation({
        mutationFn: async ({ data }: { data: CreateMaintenanceData }) => {
            const response = await equipmentService.addMaintenance(data);
            return response.data.maintenance;
        },
        onSuccess: (_data, variables) => {
            if (variables.data.equipmentId) {
                queryClient.invalidateQueries({ queryKey: equipmentKeys.detail(variables.data.equipmentId) });
            }
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.stats() });
        },
    });

    return {
        equipment: equipmentQuery.data?.equipment ?? [],
        total: equipmentQuery.data?.total ?? 0,
        page: equipmentQuery.data?.page ?? 1,
        pageSize: equipmentQuery.data?.pageSize ?? 10,
        totalPages: equipmentQuery.data?.totalPages ?? 1,
        isLoading: equipmentQuery.isLoading,
        isError: equipmentQuery.isError,
        error: equipmentQuery.error,

        createEquipment: createMutation.mutateAsync,
        isCreating: createMutation.isPending,

        updateEquipment: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deleteEquipment: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        addMaintenance: addMaintenanceMutation.mutateAsync,
        isAddingMaintenance: addMaintenanceMutation.isPending,

        refetch: equipmentQuery.refetch,
    };
}

// ============================================
// HOOK DETALLE — Equipo por ID
// ============================================

export function useEquipmentDetail(id: string | null) {
    const queryClient = useQueryClient();

    const detailQuery = useQuery({
        queryKey: equipmentKeys.detail(id ?? ''),
        queryFn: async () => {
            const response = await equipmentService.getById(id!);
            return response.data.equipment;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: async (data: UpdateEquipmentData) => {
            const response = await equipmentService.update(id!, data);
            return response.data.equipment;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: equipmentKeys.detail(id!) });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            await equipmentService.delete(id!);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.stats() });
        },
    });

    const addMaintenanceMutation = useMutation({
        mutationFn: async (data: CreateMaintenanceData) => {
            const response = await equipmentService.addMaintenance(data);
            return response.data.maintenance;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: equipmentKeys.detail(id!) });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.lists() });
            queryClient.invalidateQueries({ queryKey: equipmentKeys.stats() });
        },
    });

    return {
        equipment: detailQuery.data ?? null,
        isLoading: detailQuery.isLoading,
        isError: detailQuery.isError,

        updateEquipment: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,

        deleteEquipment: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,

        addMaintenance: addMaintenanceMutation.mutateAsync,
        isAddingMaintenance: addMaintenanceMutation.isPending,

        refetch: detailQuery.refetch,
    };
}

export function useEquipmentStats() {
    const statsQuery = useQuery({
        queryKey: equipmentKeys.stats(),
        queryFn: async () => {
            const response = await equipmentService.stats();
            return response.data.stats;
        },
    });

    return {
        stats: statsQuery.data as EquipmentStats | undefined,
        isLoading: statsQuery.isLoading,
        refetch: statsQuery.refetch,
    };
}
