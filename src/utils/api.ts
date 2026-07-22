'use client';

// Cliente API con Axios - Configuración de interceptores
// SSR-safe: solo accede a localStorage/window en el navegador
// El token se lee desde el authStore de Zustand (persistido en localStorage).

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import type { ApiErrorResponse } from '@/lib/api-error';

// ============================================
// CONFIGURACIÓN BASE
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/** Comprueba si estamos en entorno de navegador */
const isBrowser = typeof window !== 'undefined';

// ============================================
// GESTIÓN DE TOKEN — Lectura desde authStore
// ============================================
// El authStore persiste en localStorage con la clave 'auth-storage'.
// Aquí lo leemos directamente para evitar un import circular
// (api.ts ← authStore ← services ← api.ts).

const AUTH_STORAGE_KEY = 'auth-storage';

/**
 * Obtiene el token JWT desde el storage persistido de Zustand.
 * Fallback: cookie 'token' (sincronizada por el authStore).
 */
export function getToken(): string | null {
  if (!isBrowser) return null;

  // 1. Leer del storage de Zustand (localStorage)
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.state?.token;
      if (token) return token;
    }
  } catch {
    // JSON parse error — ignorar
  }

  // 2. Fallback a cookie
  const cookieToken = document.cookie
    .split('; ')
    .find((row) => row.startsWith('token='))
    ?.split('=')[1];

  return cookieToken ?? null;
}

/**
 * Limpia sesión completa: localStorage de auth + cookie.
 * Se invoca SOLO desde el interceptor 401 como último recurso.
 * El flujo normal de logout usa authStore.logout().
 */
function clearSession(): void {
  if (!isBrowser) return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.cookie = 'token=; path=/; max-age=0';
}

// ============================================
// INSTANCIA DE AXIOS
// ============================================

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000, // 15 segundos
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ============================================
// INTERCEPTOR DE REQUEST
// Adjunta el token JWT a cada petición saliente
// ============================================

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// ============================================
// INTERCEPTOR DE RESPONSE
// Manejo centralizado de errores HTTP
// ============================================

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (!error.response) {
      // Error de red / timeout
      console.error('[API] Error de conexión:', error.message);
      return Promise.reject(error);
    }

    const { status } = error.response;
    const responseData = error.response.data;

    switch (status) {
      case 401:
        // No autorizado → limpiar sesión y redirigir al login
        clearSession();
        if (isBrowser && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        break;

      case 403:
      case 400:
      case 404:
      case 409:
      case 422:
        if (process.env.NODE_ENV === 'development') {
          console.warn('[API BUSINESS ERROR]', {
            status,
            code: responseData?.error,
            message: responseData?.message,
          });
        }
        break;

      case 500: {
        console.error('[API] Error 500', {
          url: error.config?.url,
          method: error.config?.method,
          error: responseData?.error,
          message: responseData?.message,
          stage: responseData?.stage,
          details: responseData?.details,
          requestId: responseData?.requestId,
        });
        break;
      }

      case 503: {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[API] Servicio no disponible', {
            url: error.config?.url,
            method: error.config?.method,
            error: responseData?.error,
            message: responseData?.message,
            stage: responseData?.stage,
          });
        }
        break;
      }

      default:
        if (process.env.NODE_ENV === 'development') {
          console.warn('[API ERROR]', {
            status,
            code: responseData?.error,
            message: responseData?.message,
          });
        }
    }

    return Promise.reject(error);
  }
);

// ============================================
// HELPERS TIPADOS PARA PETICIONES
// ============================================

export const apiHelpers = {
  /** GET request tipado */
  get: <T = unknown>(url: string, params?: Record<string, unknown>) =>
    api.get<T>(url, { params }),

  /** POST request tipado */
  post: <T = unknown>(url: string, data?: unknown) =>
    api.post<T>(url, data),

  /** POST con FormData (multipart) */
  postForm: <T = unknown>(url: string, formData: FormData) =>
    api.post<T>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** PUT request tipado */
  put: <T = unknown>(url: string, data?: unknown) =>
    api.put<T>(url, data),

  /** PATCH request tipado */
  patch: <T = unknown>(url: string, data?: unknown) =>
    api.patch<T>(url, data),

  /** DELETE request tipado */
  delete: <T = unknown>(url: string) =>
    api.delete<T>(url),
};

export default api;
