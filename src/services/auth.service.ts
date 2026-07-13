// Servicio de Autenticación
// Endpoints: /api/auth/*

import { apiHelpers } from '@/utils/api';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterData,
  User,
} from '@/types';

const BASE = '/api/auth';

/** Forma real de la respuesta del endpoint GET /api/auth/me */
export interface MeResponse {
  user: User;
}

/** Payload para editar el perfil propio */
export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

/** Payload para cambio de contraseña */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export const authService = {
  /** Iniciar sesión → { user, token } */
  login: (credentials: LoginCredentials) =>
    apiHelpers.post<AuthResponse>(`${BASE}/login`, credentials),

  /** Registrar nuevo usuario → { user, token } */
  register: (data: RegisterData) =>
    apiHelpers.post<AuthResponse>(`${BASE}/register`, data),

  /** Obtener usuario autenticado actual → { user } */
  me: () => apiHelpers.get<MeResponse>(`${BASE}/me`),

  /** Actualizar perfil propio → { user } */
  updateProfile: (payload: UpdateProfilePayload) =>
    apiHelpers.patch<MeResponse>(`${BASE}/me`, payload),

  /** Cambiar contraseña propia → { success: true } */
  changePassword: (payload: ChangePasswordPayload) =>
    apiHelpers.post<{ success: boolean }>(`${BASE}/password`, payload),
};
