import { describe, it, expect } from 'vitest';
import {
  createRateLimiter,
  RATE_LIMIT_RULES,
  getClientIp,
  rateLimitHeaders,
} from '../src/lib/rate-limit';

function fakeRequest(headers: Record<string, string>): Request {
  return new Request('https://test.local/login', { headers });
}

describe('Rate Limiter — sliding window', () => {
  it('permite las primeras N requests dentro del windowMs', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
    for (let i = 0; i < 5; i++) {
      const r = limiter.check('user-1');
      expect(r.success).toBe(true);
    }
    const overflow = limiter.check('user-1');
    expect(overflow.success).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it('resetea el contador cuando la ventana vence', async () => {
    const limiter = createRateLimiter({ windowMs: 100, max: 2 });
    expect(limiter.check('u').success).toBe(true);
    expect(limiter.check('u').success).toBe(true);
    expect(limiter.check('u').success).toBe(false);
    await new Promise((r) => setTimeout(r, 110));
    expect(limiter.check('u').success).toBe(true);
  });

  it('keys distintas no se interfieren', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check('ip-A').success).toBe(true);
    expect(limiter.check('ip-A').success).toBe(false);
    expect(limiter.check('ip-B').success).toBe(true);
  });

  it('cleanup() elimina entradas vencidas', async () => {
    const limiter = createRateLimiter({ windowMs: 50, max: 5 });
    limiter.check('a');
    limiter.check('b');
    await new Promise((r) => setTimeout(r, 60));
    limiter.cleanup();
    // Después de cleanup, nuevo check vuelve a permitir
    const r = limiter.check('a');
    expect(r.success).toBe(true);
  });

  it('resetMs decrece mientras pasa el tiempo', async () => {
    const limiter = createRateLimiter({ windowMs: 500, max: 1 });
    const first = limiter.check('x');
    expect(first.resetMs).toBeGreaterThan(400);
    await new Promise((r) => setTimeout(r, 100));
    const second = limiter.check('x');
    expect(second.resetMs).toBeLessThan(first.resetMs);
  });
});

describe('Rate limit helpers', () => {
  it('RATE_LIMIT_RULES contiene los presets esperados', () => {
    expect(RATE_LIMIT_RULES.LOGIN).toEqual({ windowMs: 60_000, max: 5 });
    expect(RATE_LIMIT_RULES.MUTATION).toEqual({ windowMs: 60_000, max: 30 });
    expect(RATE_LIMIT_RULES.READ).toEqual({ windowMs: 60_000, max: 120 });
    expect(RATE_LIMIT_RULES.UPLOAD).toEqual({ windowMs: 60_000, max: 10 });
  });

  it('getClientIp extrae IP de x-forwarded-for', () => {
    const req = fakeRequest({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('getClientIp usa x-real-ip si no hay x-forwarded-for', () => {
    const req = fakeRequest({ 'x-real-ip': '198.51.100.7' });
    expect(getClientIp(req)).toBe('198.51.100.7');
  });

  it('getClientIp devuelve "unknown" si no hay headers', () => {
    expect(getClientIp(fakeRequest({}))).toBe('unknown');
  });

  it('rateLimitHeaders produce los 3 headers estándar', () => {
    const headers = rateLimitHeaders({ success: true, remaining: 7, resetMs: 30000, limit: 10 });
    expect(headers).toEqual({
      'X-RateLimit-Limit':     '10',
      'X-RateLimit-Remaining': '7',
      'X-RateLimit-Reset':     '30',
    });
  });
});
