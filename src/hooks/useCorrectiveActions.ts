'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { correctiveActionsService } from '@/services/corrective-actions.service';
import type { CorrectiveAction } from '@/types';

export const actionKeys = {
    all: ['corrective-actions'] as const,
    lists: () => [...actionKeys.all, 'list'] as const,
    list: (filters: any) => [...actionKeys.lists(), { filters }] as const,
};

export function useCorrectiveActions(filters: any = {}) {
    const queryClient = useQueryClient();

    const actionsQuery = useQuery({
        queryKey: actionKeys.list(filters),
        queryFn: async () => {
            const response = await correctiveActionsService.list(filters);
            return response.data.actions;
        },
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => correctiveActionsService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: actionKeys.all });
            queryClient.invalidateQueries({ queryKey: ['audits'] }); // Invalida auditorías para refrescar hallazgos
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            correctiveActionsService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: actionKeys.all });
            queryClient.invalidateQueries({ queryKey: ['audits'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => correctiveActionsService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: actionKeys.all });
            queryClient.invalidateQueries({ queryKey: ['audits'] });
        },
    });

    return {
        actions: actionsQuery.data ?? [],
        isLoading: actionsQuery.isLoading,
        createAction: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        updateAction: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
        deleteAction: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
    };
}
