// ============================================
// Servicio de Usuarios
// Endpoints: /api/users
// ============================================

import { apiHelpers } from '@/utils/api';
import type { User, UpdateUserData, CreateUserData } from '@/types';

const BASE = '/api/users';

/** Forma de la respuesta GET /api/users */
export interface UsersListResponse {
    users: User[];
}

/** Forma de la respuesta POST/PATCH /api/users */
export interface UserResponse {
    user: User;
}

export const usersService = {
    /** Listar usuarios con filtros opcionales */
    list: (filters?: { role?: string; search?: string; isActive?: string }) =>
        apiHelpers.get<UsersListResponse>(
            BASE,
            filters as Record<string, unknown>
        ),

    /** Crear un nuevo usuario (admin) */
    create: (data: CreateUserData) =>
        apiHelpers.post<UserResponse>(BASE, data),

    /** Actualizar un usuario (rol, nombre, estado activo, etc.) */
    update: (id: string, data: UpdateUserData) =>
        apiHelpers.patch<UserResponse>(BASE, { id, ...data }),
};
