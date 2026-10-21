import { NextRequest, NextResponse } from 'next/server';
import { routeToAccess } from '@/platform/security/route-access';
import { decodeModulesFromJwt } from '@/platform/security/jwt-modules';
import { decodeRouteSpecialsFromJwt } from '@/platform/security/jwt-route-specials';
import { officialPermissionSetForRole } from '@/platform/security/authorization/official-role-permissions';
import { organizationRoleForSessionRole } from '@/platform/security/module-effective';
import type { SessionRole } from '@/lib/session-roles';
import { ROUTE_ACCESS_BY_MODULE } from '@/platform/security/session-module-access';

function sessionRoleMatchesAllowlist(sessionRole: string, allowedRoles: readonly string[]): boolean {
  if (allowedRoles.includes(sessionRole)) return true;
  if (sessionRole === 'IT_MANAGER' && allowedRoles.includes('IT')) return true;
  if (sessionRole === 'OWNER' && allowedRoles.includes('ADMIN')) return true;
  return false;
}
import { isDeprecatedFrontendPath } from '@/lib/deprecated-frontend-paths';
import {
  JWT_ALGORITHM,
  validateTokenClaims,
  type TokenClaims,
} from '@/lib/jwt-config';

// ============================================
// NEXT.JS MIDDLEWARE — Protección de rutas + RBAC + CSP nonce
// Sprint 3: la matriz de permisos vive en lib/permissions.ts (única fuente
// de verdad). Este middleware orquesta JWT + redirecciones + CSP nonce.
// S2: validación JWT estricta en Edge (alg=HS256, exp, iss, aud, claims).
// ============================================

const AUTH_ROUTES  = ['/login', '/register'];

const MUST_CHANGE_PASSWORD_PATH = '/settings/cambiar-contrasena';

export function postLoginPathForRole(role?: string | null, mustChangePassword?: boolean): string {
  if (mustChangePassword) return MUST_CHANGE_PASSWORD_PATH;
  return role === 'SECRETARIA' ? '/oficios/todos' : '/dashboard';
}

function isMustChangePasswordExemptPath(pathname: string): boolean {
  return (
    pathname === MUST_CHANGE_PASSWORD_PATH ||
    pathname.startsWith(`${MUST_CHANGE_PASSWORD_PATH}/`)
  );
}

export function buildRequestRedirectUrl(request: NextRequest, path: string, environment = process.env.NODE_ENV): URL {
  const url = new URL(path, request.url);
  if (environment !== 'production' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    url.protocol = 'http:';
    url.port = '3000';
  }
  return url;
}
// Next.js espera 'x-nonce' y parsea el nonce desde Content-Security-Policy del request.
const NONCE_HEADER = 'x-nonce';

function logAuthorizationDecision(input: {
  requestedPath: string;
  resolvedModule: string | null;
  userId?: string;
  role?: string;
  authorizationDecision: 'ALLOW' | 'DENY' | 'LOGIN';
  redirectReason?: string;
}): void {
  if (process.env.NODE_ENV !== 'development' && process.env.APP_ENV !== 'e2e') return;
  console.info('[navigation.authorization]', JSON.stringify(input));
}

function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  // Convertir a base64 (seguro para header)
  let binary = '';
  arr.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function buildCspHeader(nonce: string): string {
  // Política estricta con nonce para scripts.
  // 'strict-dynamic' permite que scripts cargados por los de confianza
  // se ejecuten sin necesidad de self en sub-recursos.
  // En desarrollo, React Refresh (HMR) requiere 'unsafe-eval'; en producción se omite.
  // Estilos: permitir 'self' + 'unsafe-inline' (Tailwind v4 + shadcn requiere)
  // Imágenes: self + data: + https: (logos remotos).
  // Conexiones: self + S3/CloudFront si se define S3_PUBLIC_URL en runtime.
  const s3Host = process.env.S3_PUBLIC_URL
    ? ` ${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}`
    : '';
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
  ].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:" + s3Host,
    "font-src 'self' data:",
    `connect-src 'self'${s3Host}`,
    "object-src 'none'",
    // blob: required for client-side PDF print iframe (purchase orders).
    "frame-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');
}

function buildExtraSecurityHeaders(): string[] {
  return [
    'X-Frame-Options: DENY',
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    'Permissions-Policy: camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy: same-origin',
    'Cross-Origin-Embedder-Policy: require-corp',
  ];
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment<T = unknown>(segment: string): T | null {
  try {
    const text = new TextDecoder().decode(decodeBase64Url(segment));
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function decodeAndVerifyJwt(token: string): Promise<TokenClaims | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const secret = process.env.JWT_SECRET || '';
    if (!secret) return null;

    const header = decodeJsonSegment<{ alg?: string; typ?: string }>(parts[0]);
    if (!header) return null;
    if (header.alg !== JWT_ALGORITHM) return null;
    if (header.typ && header.typ !== 'JWT') return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = decodeBase64Url(parts[2]);
    const dataBytes = encoder.encode(parts[0] + '.' + parts[1]);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as BufferSource,
      dataBytes as BufferSource
    );
    if (!isValid) return null;

    const rawPayload = decodeJsonSegment(parts[1]);
    return validateTokenClaims(rawPayload);
  } catch (error) {
    console.error('Error verifying JWT in edge:', error);
    return null;
  }
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function applyCspToRequest(requestHeaders: Headers, nonce: string): void {
  const csp = buildCspHeader(nonce);
  requestHeaders.set(NONCE_HEADER, nonce);
  // Next.js extrae el nonce del CSP del request para inyectarlo en scripts de hidratación.
  requestHeaders.set('Content-Security-Policy', csp);
}

function applySecurityHeaders(response: NextResponse, nonce: string): void {
  const csp = buildCspHeader(nonce);
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set(NONCE_HEADER, nonce);
  for (const header of buildExtraSecurityHeaders()) {
    const [k, v] = header.split(': ');
    response.headers.set(k, v);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = generateNonce();

  // Rutas frontend legacy fuera de alcance → dashboard
  if (isDeprecatedFrontendPath(pathname)) {
    const res = NextResponse.redirect(new URL('/dashboard', request.url));
    applySecurityHeaders(res, nonce);
    return res;
  }

  const requestHeaders = new Headers(request.headers);
  applyCspToRequest(requestHeaders, nonce);

  const token = requestHeaders.get('cookie')?.match(/(?:^|;\s*)token=([^;]+)/)?.[1] ?? null;

  const access = routeToAccess(pathname);
  const authRoute = isAuthRoute(pathname);

  // 1) Ruta protegida sin token → /login con callback
  if (access && !token) {
    logAuthorizationDecision({
      requestedPath: pathname,
      resolvedModule: access.module,
      authorizationDecision: 'LOGIN',
      redirectReason: 'AUTHENTICATION_REQUIRED',
    });
    const res = NextResponse.redirect(buildRequestRedirectUrl(request, '/login'));
    applySecurityHeaders(res, nonce);
    return res;
  }

  // 2) Ruta protegida — acceso por módulo (JWT) con fallback a plantilla de rol
  if (access && token) {
    const payload = await decodeAndVerifyJwt(token);
    if (!payload) {
      logAuthorizationDecision({
        requestedPath: pathname,
        resolvedModule: access.module,
        authorizationDecision: 'DENY',
        redirectReason: 'INVALID_SESSION',
      });
      const forbiddenUrl = buildRequestRedirectUrl(request, '/forbidden');
      forbiddenUrl.searchParams.set('from', pathname);
      const res = NextResponse.redirect(forbiddenUrl);
      applySecurityHeaders(res, nonce);
      return res;
    }

    const modules = decodeModulesFromJwt(payload.mod);
    const allowedByJwt = modules.has(access.module);
    const legacyRoles = ROUTE_ACCESS_BY_MODULE[access.module];
    const allowedByRole =
      !payload.mod && legacyRoles
        ? sessionRoleMatchesAllowlist(payload.role, legacyRoles)
        : false;

    if (!allowedByJwt && !allowedByRole) {
      logAuthorizationDecision({
        requestedPath: pathname,
        resolvedModule: access.module,
        userId: payload.userId,
        role: payload.role,
        authorizationDecision: 'DENY',
        redirectReason: 'MODULE_NOT_ALLOWED',
      });
      const forbiddenUrl = buildRequestRedirectUrl(request, '/forbidden');
      forbiddenUrl.searchParams.set('from', pathname);
      const res = NextResponse.redirect(forbiddenUrl);
      applySecurityHeaders(res, nonce);
      return res;
    }

    if (access.requiredSpecial) {
      const specials = decodeRouteSpecialsFromJwt(payload.spe);
      let allowedBySpecial = specials.has(access.requiredSpecial);
      if (!allowedBySpecial && !payload.mod) {
        const orgRole = organizationRoleForSessionRole(payload.role as SessionRole);
        allowedBySpecial = officialPermissionSetForRole(orgRole).has(access.requiredSpecial);
      }
      if (!allowedBySpecial) {
        logAuthorizationDecision({
          requestedPath: pathname,
          resolvedModule: access.module,
          userId: payload.userId,
          role: payload.role,
          authorizationDecision: 'DENY',
          redirectReason: 'SPECIAL_PERMISSION_REQUIRED',
        });
        const forbiddenUrl = buildRequestRedirectUrl(request, '/forbidden');
        forbiddenUrl.searchParams.set('from', pathname);
        const res = NextResponse.redirect(forbiddenUrl);
        applySecurityHeaders(res, nonce);
        return res;
      }
    }

    if (payload.mustChangePassword && !isMustChangePasswordExemptPath(pathname)) {
      const res = NextResponse.redirect(buildRequestRedirectUrl(request, MUST_CHANGE_PASSWORD_PATH));
      applySecurityHeaders(res, nonce);
      return res;
    }

    logAuthorizationDecision({
      requestedPath: pathname,
      resolvedModule: access.module,
      userId: payload.userId,
      role: payload.role,
      authorizationDecision: 'ALLOW',
    });
  }

  // 3) Auth route con sesión válida → landing del perfil.
  // Token inválido/expirado: dejar ver /login (no redirigir a dashboard).
  if (authRoute && token) {
    const payload = await decodeAndVerifyJwt(token);
    if (payload) {
      const res = NextResponse.redirect(
        buildRequestRedirectUrl(request, postLoginPathForRole(payload.role, payload.mustChangePassword)),
      );
      applySecurityHeaders(res, nonce);
      return res;
    }
  }

  // 4) Raíz "/" → según sesión
  if (pathname === '/') {
    let landing = '/login';
    if (token) {
      const payload = await decodeAndVerifyJwt(token);
      landing = payload ? postLoginPathForRole(payload.role, payload.mustChangePassword) : '/login';
    }
    const res = NextResponse.redirect(buildRequestRedirectUrl(request, landing));
    applySecurityHeaders(res, nonce);
    return res;
  }

  // Flujo normal: pasar nonce al request para que el layout/app lo lean
  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applySecurityHeaders(res, nonce);
  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.png|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)',
  ],
};
