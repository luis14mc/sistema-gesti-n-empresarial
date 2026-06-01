'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auditsService } from '@/services/audits.service';
import type { Audit, CreateAuditData, UpdateAuditData, CreateFindingData, CreateChecklistItemData, UpdateChecklistResultData } from '@/types';

export const auditKeys = {
    all: ['audits'] as const,
    lists: () => [...auditKeys.all, 'list'] as const,
    list: (filters: any) => [...auditKeys.lists(), { filters }] as const,
    details: () => [...auditKeys.all, 'detail'] as const,
    detail: (id: string) => [...auditKeys.details(), id] as const,
};

export function useAudits(filters: any = {}) {
    const queryClient = useQueryClient();

    const auditsQuery = useQuery({
        queryKey: auditKeys.list(filters),
        queryFn: async () => {
            const response = await auditsService.list(filters);
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: (data: CreateAuditData) => auditsService.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
        },
    });

    return {
        audits: auditsQuery.data?.audits ?? [],
        total: auditsQuery.data?.total ?? 0,
        page: auditsQuery.data?.page ?? 1,
        pageSize: auditsQuery.data?.pageSize ?? 10,
        totalPages: auditsQuery.data?.totalPages ?? 1,
        isLoading: auditsQuery.isLoading,
        isError: auditsQuery.isError,
        createAudit: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
    };
}

export function useAuditDetail(id: string) {
    const queryClient = useQueryClient();

    const auditQuery = useQuery({
        queryKey: auditKeys.detail(id),
        queryFn: async () => {
            const response = await auditsService.getById(id);
            return response.data.audit;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateAuditData) => auditsService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: auditKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => auditsService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
        },
    });

    const addFindingMutation = useMutation({
        mutationFn: (data: CreateFindingData) => auditsService.addFinding(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: auditKeys.detail(id) });
        },
    });

    const addChecklistItemMutation = useMutation({
        mutationFn: (data: CreateChecklistItemData) => auditsService.addChecklistItem(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: auditKeys.detail(id) });
        },
    });

    const updateChecklistResultMutation = useMutation({
        mutationFn: ({ itemId, data }: { itemId: string; data: UpdateChecklistResultData }) =>
            auditsService.updateChecklistResult(id, itemId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: auditKeys.detail(id) });
        },
    });

    return {
        audit: auditQuery.data ?? null,
        isLoading: auditQuery.isLoading,
        isError: auditQuery.isError,
        updateAudit: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
        deleteAudit: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
        addFinding: addFindingMutation.mutateAsync,
        isAddingFinding: addFindingMutation.isPending,
        addChecklistItem: addChecklistItemMutation.mutateAsync,
        isAddingChecklistItem: addChecklistItemMutation.isPending,
        updateChecklistResult: updateChecklistResultMutation.mutateAsync,
        isUpdatingChecklistResult: updateChecklistResultMutation.isPending,
    };
}
