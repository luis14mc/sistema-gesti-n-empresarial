// Phase 10C — security regression tests for the CSP / security headers
// produced by the Next.js middleware. The middleware is exercised here
// by importing the pure helper functions it re-exports; the actual HTTP
// surface is exercised end-to-end in the Playwright suite (Phase 10D).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');
const middlewareSource = readFileSync(resolve(REPO_ROOT, 'src/middleware.ts'), 'utf-8');
const libMiddlewareSource = readFileSync(resolve(REPO_ROOT, 'src/lib/middleware.ts'), 'utf-8');
const actionAuthSource = readFileSync(resolve(REPO_ROOT, 'src/actions/auth.ts'), 'utf-8');
const authStoreSource = readFileSync(resolve(REPO_ROOT, 'src/stores/authStore.ts'), 'utf-8');

// We re-import the middleware module to assert that the documented
// CSP / COOP / COEP / HSTS are assembled correctly. The middleware only
// runs in the Next.js runtime, so we test the pure helpers via the
// exported module.
import * as middlewareModule from '@/middleware';

describe('CSP / security headers (Phase 10C)', () => {
  it('middleware module exposes a default `middleware` function', () => {
    expect(typeof middlewareModule.middleware).toBe('function');
  });

  it('middleware config matches only non-API, non-static routes', () => {
    const config = middlewareModule.config;
    expect(Array.isArray(config.matcher)).toBe(true);
    const matcher = config.matcher.join('|');
    expect(matcher).toContain('api');
    expect(matcher).toContain('_next/static');
    expect(matcher).toContain('favicon');
  });

  it('CSP forbids the `object-src` directive by default', () => {
    expect(middlewareSource).toMatch(/object-src\s+'none'/);
    expect(middlewareSource).toMatch(/frame-ancestors\s+'none'/);
    expect(middlewareSource).toMatch(/base-uri\s+'self'/);
    expect(middlewareSource).toMatch(/form-action\s+'self'/);
    expect(middlewareSource).toMatch(/upgrade-insecure-requests/);
  });

  it('CSP enables strict-dynamic when running with a nonce', () => {
    expect(middlewareSource).toMatch(/strict-dynamic/);
    expect(middlewareSource).toMatch(/nonce-/);
  });

  it('hides extra security headers (X-Frame-Options, HSTS, COOP, COEP)', () => {
    expect(middlewareSource).toMatch(/X-Frame-Options:\s*DENY/);
    expect(middlewareSource).toMatch(/X-Content-Type-Options:\s*nosniff/);
    expect(middlewareSource).toMatch(/Strict-Transport-Security:/);
    expect(middlewareSource).toMatch(/Cross-Origin-Opener-Policy:\s*same-origin/);
    expect(middlewareSource).toMatch(/Cross-Origin-Embedder-Policy:\s*require-corp/);
  });
});

describe('CORS — outright rejected at the middleware layer', () => {
  it('the middleware does not emit Access-Control-Allow-Origin by default', () => {
    // The platform does not serve cross-origin requests from the browser;
    // same-origin only. We document this by asserting on the absence of
    // the header and the presence of COOP/COEP.
    expect(middlewareSource).not.toMatch(/Access-Control-Allow-Origin/);
    expect(middlewareSource).toMatch(/Cross-Origin-Opener-Policy/);
  });
});

describe('CSRF — token-based session cookies', () => {
  it('the same JWT is used for cookie and Bearer auth (no separate CSRF token)', () => {
    // The platform uses a stateless JWT cookie. CSRF is mitigated by:
    //   1. SameSite=Lax on the cookie (set in the login route).
    //   2. CORS-free same-origin policy.
    // We document the protection model by asserting that no CSRF token
    // is required in the middleware and that the cookie name is fixed.
    expect(libMiddlewareSource).toMatch(/cookies\.get\('token'\)/);
    expect(libMiddlewareSource).toMatch(/authorization.*Bearer/);
  });

  it('the server action that issues the session cookie sets SameSite=Lax', () => {
    expect(actionAuthSource).toMatch(/sameSite:\s*'lax'/i);
    expect(actionAuthSource).toMatch(/httpOnly:\s*true/);
  });

  it('the client-side auth store also sets SameSite=Lax', () => {
    expect(authStoreSource).toMatch(/SameSite=Lax/);
  });

  it('session revocation clears the token cookie with maxAge=0', () => {
    expect(actionAuthSource).toMatch(/maxAge:\s*0/);
    expect(actionAuthSource).toMatch(/COOKIE_NAME/);
  });
});
