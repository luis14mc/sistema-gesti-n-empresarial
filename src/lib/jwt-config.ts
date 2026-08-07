/**
 * JWT shared configuration — importable desde Node y Edge runtime.
 * Single source of truth para algoritmo, issuer, audience y roles válidos.
 */

export const JWT_ALGORITHM = 'HS256' as const;
export const JWT_ISSUER = 'sge';
export const JWT_AUDIENCE = 'sge-web';
export const JWT_EXPIRES_IN = '1h';

/** Máxima edad aceptada para un token (anti-replay de tokens viejos). */
export const JWT_MAX_AGE_SECONDS = 60 * 60; // 1h, alineado con expiresIn

export const VALID_ROLES = new Set(['ADMIN', 'USER', 'RRHH', 'IT']);

export type Role = 'ADMIN' | 'USER' | 'RRHH' | 'IT';

export interface TokenClaims {
  userId: string;
  email: string;
  role: Role;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
  jti?: string;
}

/**
 * Valida los claims del payload JWT según la política del sistema.
 * Retorna el payload normalizado si es válido, o null si falla.
 */
export function validateTokenClaims(payload: unknown): TokenClaims | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  if (typeof p.userId !== 'string' || p.userId.length === 0) return null;
  if (typeof p.email !== 'string' || p.email.length === 0) return null;
  if (typeof p.role !== 'string' || !VALID_ROLES.has(p.role)) return null;

  if (typeof p.exp !== 'number' || p.exp <= 0) return null;
  if (typeof p.iat !== 'number' || p.iat <= 0) return null;

  if (p.iss !== JWT_ISSUER) return null;

  const aud = p.aud;
  const audValid = aud === JWT_AUDIENCE || (Array.isArray(aud) && aud.includes(JWT_AUDIENCE));
  if (!audValid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (p.exp <= now) return null;

  const ageSeconds = now - p.iat;
  if (ageSeconds < 0 || ageSeconds > JWT_MAX_AGE_SECONDS) return null;

  return {
    userId: p.userId,
    email: p.email,
    role: p.role as Role,
    iss: p.iss as string,
    aud: p.aud as string | string[],
    iat: p.iat,
    exp: p.exp,
    jti: typeof p.jti === 'string' ? p.jti : undefined,
  };
}
