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

export const authService = {
  /** Iniciar sesión → { user, token } */
  login: (credentials: LoginCredentials) =>
    apiHelpers.post<AuthResponse>(`${BASE}/login`, credentials),

  /** Registrar nuevo usuario → { user, token } */
  register: (data: RegisterData) =>
    apiHelpers.post<AuthResponse>(`${BASE}/register`, data),

  /** Obtener usuario autenticado actual → { user } */
  me: () => apiHelpers.get<MeResponse>(`${BASE}/me`),
};
