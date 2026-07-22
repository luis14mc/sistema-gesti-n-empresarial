import { NextRequest, NextResponse } from 'next/server';
import { routeToAccess } from '@/lib/permissions';
import { isDeprecatedFrontendPath } from '@/lib/deprecated-api';

// ============================================
// NEXT.JS MIDDLEWARE — Protección de rutas + RBAC + CSP nonce
// Sprint 3: la matriz de permisos vive en lib/permissions.ts (única fuente
// de verdad). Este middleware orquesta JWT + redirecciones + CSP nonce.
// ============================================

type Role = 'ADMIN' | 'USER' | 'RRHH' | 'IT';

const TOKEN_COOKIE = 'token';
const AUTH_ROUTES  = ['/login', '/register'];
// Next.js espera 'x-nonce' y parsea el nonce desde Content-Security-Policy del request.
const NONCE_HEADER = 'x-nonce';

function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  // Convertir a base64 (seguro para header)
  let binary = '';
  arr.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function buildCspHeader(nonce: string): string {
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

async function decodeAndVerifyJwt(token: string): Promise<{ userId: string; role: Role } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const secret = process.env.JWT_SECRET || '';
    if (!secret) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureStr = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const paddedSignature = signatureStr.padEnd(signatureStr.length + (4 - signatureStr.length % 4) % 4, '=');
    const signatureBytes = Uint8Array.from(atob(paddedSignature), c => c.charCodeAt(0));
    const dataBytes = encoder.encode(parts[0] + '.' + parts[1]);

    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes);
    if (!isValid) return null;

    const payloadStr = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = payloadStr.padEnd(payloadStr.length + (4 - payloadStr.length % 4) % 4, '=');
    const payload = JSON.parse(atob(paddedPayload));
    return payload;
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
    const res = NextResponse.redirect(new URL('/login', request.url));
    applySecurityHeaders(res, nonce);
    return res;
  }

  // 2) Ruta protegida con restricción de rol
  if (access && token && access.roles) {
    const payload = await decodeAndVerifyJwt(token);
    if (!payload || !access.roles.includes(payload.role)) {
      const res = NextResponse.redirect(new URL('/dashboard', request.url));
      applySecurityHeaders(res, nonce);
      return res;
    }
  }

  // 3) Auth route con sesión activa → dashboard
  if (authRoute && token) {
    const res = NextResponse.redirect(new URL('/dashboard', request.url));
    applySecurityHeaders(res, nonce);
    return res;
  }

  // 4) Raíz "/" → según sesión
  if (pathname === '/') {
    const res = NextResponse.redirect(
      new URL(token ? '/dashboard' : '/login', request.url)
    );
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
