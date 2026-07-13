// =====================================================
// Rate Limiting — Edge-compatible (Web Crypto)
// Sprint 3: protege login y APIs sensibles
// =====================================================

/**
 * Implementación in-memory del algoritmo "sliding window" mediante un Map.
 * Funciona en Edge runtime (sin Redis por ahora).
 * Limitaciones:
 *   - El estado vive en la instancia del worker (no compartido entre procesos).
 *   - En deployments serverless con múltiples workers, usar Redis o
 *     Cloudflare KV en producción. Mantenemos esta versión simple para MVP.
 *
 * Para una versión producción, reemplazar `store` por Upstash Redis
 * (`@upstash/ratelimit`) manteniendo la misma interfaz RateLimiter.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number; // ms epoch
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

export interface RateLimitRule {
  /** Tamaño de la ventana en ms */
  windowMs: number;
  /** Máximo de requests dentro de la ventana */
  max: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  /** Limpia entradas vencidas (llamar periódicamente o vía cron) */
  cleanup(): void;
}

/**
 * Crea un limiter con sliding window fijo (más simple que sliding log).
 *
 * @example
 *   const loginLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
 *   const result = loginLimiter.check(ip);
 *   if (!result.success) return new Response('Too Many Requests', { status: 429 });
 */
export function createRateLimiter(rule: RateLimitRule): RateLimiter {
  const store = new Map<string, RateLimitEntry>();

  function check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now - entry.windowStart >= rule.windowMs) {
      // Nueva ventana
      store.set(key, { count: 1, windowStart: now });
      return {
        success: true,
        remaining: rule.max - 1,
        resetMs: rule.windowMs,
        limit: rule.max,
      };
    }

    if (entry.count >= rule.max) {
      const elapsed = now - entry.windowStart;
      return {
        success: false,
        remaining: 0,
        resetMs: rule.windowMs - elapsed,
        limit: rule.max,
      };
    }

    entry.count += 1;
    return {
      success: true,
      remaining: rule.max - entry.count,
      resetMs: rule.windowMs - (now - entry.windowStart),
      limit: rule.max,
    };
  }

  function cleanup(): void {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (now - v.windowStart >= rule.windowMs) {
        store.delete(k);
      }
    }
  }

  return { check, cleanup };
}

/**
 * Reglas predefinidas por tipo de endpoint.
 * Aplicar en middleware o al inicio del route handler.
 */
export const RATE_LIMIT_RULES = {
  /** Login: 5 intentos por minuto por IP */
  LOGIN: { windowMs: 60_000, max: 5 },
  /** Mutaciones (POST/PATCH/DELETE): 30 por minuto por usuario */
  MUTATION: { windowMs: 60_000, max: 30 },
  /** Read endpoints: 120 requests por minuto por IP */
  READ: { windowMs: 60_000, max: 120 },
  /** Uploads: 10 por minuto por usuario */
  UPLOAD: { windowMs: 60_000, max: 10 },
} as const;

/**
 * Extrae la IP del request desde headers comunes de proxy.
 * Funciona en Edge runtime.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Construye los headers de respuesta estándar de rate limiting.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit':     String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset':     String(Math.ceil(result.resetMs / 1000)),
  };
}
