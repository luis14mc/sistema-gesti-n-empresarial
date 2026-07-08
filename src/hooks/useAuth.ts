'use client';

// ============================================
// HOOK useAuth - React Query + Zustand
// ============================================
// Expone funciones de alto nivel para autenticación:
//   loginMutation, registerMutation, logout, user, checkAuth
// Conecta las mutaciones de React Query con el authStore.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { AxiosError } from 'axios';

import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';
import type {
  LoginCredentials,
  RegisterData,
  User,
  AuthResponse,
} from '@/types';

// ============================================
// QUERY KEYS
// ============================================

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

// ============================================
// TIPOS DE ERROR DEL BACKEND
// ============================================

interface BackendError {
  error: string;
}

/** Extrae el mensaje de error del backend o devuelve uno genérico */
function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as BackendError | undefined;
    return data?.error || error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Ha ocurrido un error inesperado';
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // --- Store ---
  const {
    user,
    token,
    isAuthenticated,
    _hasHydrated,
    login: storeLogin,
    logout: storeLogout,
    setUser,
  } = useAuthStore();

  // ========================================
  // CHECK AUTH - Verifica token contra /api/auth/me
  // Se ejecuta solo si hay token y el store ya rehidrató
  // ========================================

  const {
    data: checkedUser,
    isLoading: isCheckingAuth,
    error: checkAuthError,
  } = useQuery({
    queryKey: authKeys.me(),
    queryFn: async (): Promise<User> => {
      const response = await authService.me();
      const userData = response.data.user;
      setUser(userData);
      return userData;
    },
    // Ejecutar cuando hydrated: si hay token en Zustand O si hay cookie HttpOnly
    // (el browser envía la cookie automáticamente en same-origin requests)
    enabled: _hasHydrated,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // ========================================
  // LOGIN MUTATION
  // ========================================

  const loginMutation = useMutation<AuthResponse, Error, LoginCredentials>({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await authService.login(credentials);
      return response.data;
    },
    onSuccess: (data: AuthResponse) => {
      // Guardar en store (persiste en localStorage + cookie)
      storeLogin(data.user, data.token);
      // Invalidar query de /me para que se refresque
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      // Navegar al dashboard
      router.push('/dashboard');
    },
  });

  // ========================================
  // REGISTER MUTATION
  // ========================================

  const registerMutation = useMutation<AuthResponse, Error, RegisterData>({
    mutationFn: async (data: RegisterData) => {
      const response = await authService.register(data);
      return response.data;
    },
    onSuccess: (data: AuthResponse) => {
      // Guardar en store (persiste en localStorage + cookie)
      storeLogin(data.user, data.token);
      // Invalidar query de /me
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      // Navegar al dashboard
      router.push('/dashboard');
    },
  });

  // ========================================
  // LOGOUT
  // ========================================

  const logout = useCallback(() => {
    // Limpiar store (limpia localStorage + cookie)
    storeLogout();
    // Limpiar todas las queries cacheadas
    queryClient.clear();
    // Redirigir al login
    router.push('/login');
  }, [storeLogout, queryClient, router]);

  // ========================================
  // RETURN
  // ========================================

  return {
    // --- Estado ---
    user: user ?? checkedUser ?? null,
    token,
    isAuthenticated,
    isHydrated: _hasHydrated,

    // --- Loading states ---
    isCheckingAuth,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,

    // --- Errores (ya como strings legibles) ---
    loginError: loginMutation.error
      ? getErrorMessage(loginMutation.error)
      : null,
    registerError: registerMutation.error
      ? getErrorMessage(registerMutation.error)
      : null,
    checkAuthError: checkAuthError
      ? getErrorMessage(checkAuthError)
      : null,

    // --- Acciones ---
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    logout,

    // --- Reset de errores ---
    resetLoginError: loginMutation.reset,
    resetRegisterError: registerMutation.reset,
  };
}
