'use client';

// ============================================
// HOOK useTimeEntries - React Query
// ============================================
// Queries y mutaciones para marcado de asistencia:
//   - Listar historial, registrar check-in/out

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntriesService } from '@/services/time-entries.service';
import type { TimeEntryFilters, CreateTimeEntryData } from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const timeEntryKeys = {
    all: ['timeEntries'] as const,
    lists: () => [...timeEntryKeys.all, 'list'] as const,
    list: (filters?: TimeEntryFilters) => [...timeEntryKeys.lists(), filters] as const,
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useTimeEntries(filters?: TimeEntryFilters) {
    const queryClient = useQueryClient();

    // --- Lista de registros ---
    const entriesQuery = useQuery({
        queryKey: timeEntryKeys.list(filters),
        queryFn: async () => {
            const response = await timeEntriesService.list(filters);
            return response.data.timeEntries;
        },
    });

    // --- Crear registro (check-in, check-out, break) ---
    const createMutation = useMutation({
        mutationFn: async (data: CreateTimeEntryData) => {
            const response = await timeEntriesService.create(data);
            return response.data.timeEntry;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: timeEntryKeys.lists() });
        },
    });

    // Determinar el último tipo de registro para saber si el próximo es entrada o salida
    const lastEntry = entriesQuery.data?.[0] ?? null;
    const nextAction: 'CHECK_IN' | 'CHECK_OUT' =
        lastEntry?.type === 'CHECK_IN' ? 'CHECK_OUT' : 'CHECK_IN';

    return {
        // --- Datos ---
        entries: entriesQuery.data ?? [],
        isLoading: entriesQuery.isLoading,
        isError: entriesQuery.isError,
        error: entriesQuery.error,

        // --- Helpers ---
        lastEntry,
        nextAction,

        // --- Mutaciones ---
        createEntry: createMutation.mutate,
        isCreating: createMutation.isPending,

        // --- Refetch manual ---
        refetch: entriesQuery.refetch,
    };
}
