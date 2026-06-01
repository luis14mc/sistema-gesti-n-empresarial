'use client';

// ============================================
// AUTH STORE - Zustand con persistencia
// ============================================
// Gestiona el estado global de autenticación:
//   - user, token, isAuthenticated
//   - Persistencia en localStorage (rehidratación automática)
//   - Cookie sincronizada para el middleware de Next.js

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';

// ============================================
// CONSTANTES
// ============================================

const STORAGE_KEY = 'auth-storage';
const TOKEN_COOKIE = 'token';

// ============================================
// HELPERS DE COOKIE
// Necesarias para sincronizar con el middleware
// de Next.js que solo puede leer cookies.
// ============================================

function setCookie(name: string, value: string, days: number = 7): void {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

// ============================================
// TIPOS DEL STORE
// ============================================

interface AuthState {
  // --- Estado ---
  /** Usuario autenticado (null si no hay sesión) */
  user: User | null;
  /** Token JWT */
  token: string | null;
  /** Derivado: true si user y token existen */
  isAuthenticated: boolean;
  /** true una vez que Zustand rehidrató desde localStorage */
  _hasHydrated: boolean;

  // --- Acciones ---
  /** Guarda usuario y token tras login/register exitoso */
  login: (user: User, token: string) => void;
  /** Limpia la sesión completa */
  logout: () => void;
  /** Actualiza solo los datos del usuario (ej: tras editar perfil) */
  setUser: (user: User) => void;
  /** Marca la rehidratación como completada (uso interno) */
  setHasHydrated: (value: boolean) => void;
}

// ============================================
// STORE
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // --- Estado inicial ---
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      // --- Acciones ---

      login: (user: User, token: string) => {
        // Sincronizar cookie para que el middleware de Next.js la lea
        setCookie(TOKEN_COOKIE, token, 7);

        set({
          user,
          token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        // Limpiar cookie
        removeCookie(TOKEN_COOKIE);

        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setUser: (user: User) => {
        set({ user });
      },

      setHasHydrated: (value: boolean) => {
        set({ _hasHydrated: value });
      },
    }),
    {
      name: STORAGE_KEY,

      // Solo persistir user y token (no flags internos)
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),

      storage: createJSONStorage(() => {
        // SSR-safe: devuelve un storage noop en el servidor
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),

      // Callback cuando la rehidratación finaliza
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error('[AuthStore] Error al rehidratar:', error);
          }

          // Si rehidrató con token, sincronizar la cookie
          if (state?.token) {
            setCookie(TOKEN_COOKIE, state.token, 7);
          }

          // Marcar como rehidratado
          state?.setHasHydrated(true);
        };
      },
    }
  )
);

// ============================================
// SELECTORES (para optimizar re-renders)
// ============================================

/** Solo el usuario */
export const useAuthUser = () => useAuthStore((s) => s.user);

/** Solo isAuthenticated */
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);

/** Solo el token */
export const useAuthToken = () => useAuthStore((s) => s.token);

/** true cuando el store terminó de rehidratar desde localStorage */
export const useAuthHydrated = () => useAuthStore((s) => s._hasHydrated);
