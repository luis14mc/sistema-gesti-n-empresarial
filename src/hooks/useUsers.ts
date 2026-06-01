'use client';

// ============================================
// HOOK useUsers - React Query
// ============================================
// Queries y mutaciones para gestión de usuarios:
//   - Listar usuarios, actualizar rol/estado

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '@/services/users.service';
import type { UpdateUserData, CreateUserData } from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const userKeys = {
    all: ['users'] as const,
    lists: () => [...userKeys.all, 'list'] as const,
    list: (filters?: Record<string, string>) => [...userKeys.lists(), filters] as const,
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useUsers(filters?: { role?: string; search?: string; isActive?: string }) {
    const queryClient = useQueryClient();

    // --- Lista de usuarios ---
    const usersQuery = useQuery({
        queryKey: userKeys.list(filters as Record<string, string>),
        queryFn: async () => {
            const response = await usersService.list(filters);
            return response.data.users;
        },
    });

    // --- Crear usuario ---
    const createMutation = useMutation({
        mutationFn: async (data: CreateUserData) => {
            const response = await usersService.create(data);
            return response.data.user;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });

    // --- Actualizar usuario ---
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateUserData }) => {
            const response = await usersService.update(id, data);
            return response.data.user;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
        },
    });

    return {
        // --- Datos ---
        users: usersQuery.data ?? [],
        isLoading: usersQuery.isLoading,
        isError: usersQuery.isError,
        error: usersQuery.error,

        // --- Mutaciones ---
        createUser: createMutation.mutate,
        isCreating: createMutation.isPending,

        updateUser: updateMutation.mutate,
        isUpdating: updateMutation.isPending,

        // --- Refetch manual ---
        refetch: usersQuery.refetch,
    };
}

