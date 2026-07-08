import { NextRequest, NextResponse } from 'next/server';

// ============================================
// NEXT.JS MIDDLEWARE — Protección de rutas + RBAC
// ============================================

type Role = 'ADMIN' | 'USER' | 'RRHH' | 'IT';

const TOKEN_COOKIE = 'token';

// Rutas protegidas y qué roles las pueden acceder (vacío = cualquier rol autenticado)
const ROUTE_ACCESS: Record<string, Role[] | null> = {
  '/dashboard':      null,
  '/tickets':        null,
  '/oficios':        null,
  '/time-entries':   null,
  '/equipment':      ['ADMIN', 'IT'],
  '/assignments':    ['ADMIN', 'IT'],
  '/inventory':      ['ADMIN', 'RRHH'],
  '/purchases':      ['ADMIN', 'IT', 'RRHH'],
  '/users':          ['ADMIN', 'RRHH'],
  '/audit-records':  ['ADMIN'],
  '/settings':       ['ADMIN'],
};

const AUTH_ROUTES = ['/login', '/register'];

async function decodeAndVerifyJwt(token: string): Promise<{ userId: string; role: Role } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Verificar firma usando Web Crypto API (Edge Runtime compatible)
    const secret = process.env.JWT_SECRET || '';
    if (!secret) return null; // Fallback si no hay secreto configurado

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // JWT uses base64url, so we need to convert to standard base64 first
    const signatureStr = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    // Pad with = to make length a multiple of 4
    const paddedSignature = signatureStr.padEnd(signatureStr.length + (4 - signatureStr.length % 4) % 4, '=');
    const signatureBytes = Uint8Array.from(atob(paddedSignature), c => c.charCodeAt(0));
    const dataBytes = encoder.encode(parts[0] + '.' + parts[1]);

    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes);
    
    if (!isValid) return null; // Token manipulado

    const payloadStr = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = payloadStr.padEnd(payloadStr.length + (4 - payloadStr.length % 4) % 4, '=');
    const payload = JSON.parse(atob(paddedPayload));
    return payload;
  } catch (error) {
    console.error('Error verifying JWT in edge:', error);
    return null;
  }
}

function matchRoute(pathname: string): { prefix: string; roles: Role[] | null } | null {
  for (const [prefix, roles] of Object.entries(ROUTE_ACCESS)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return { prefix, roles };
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  const routeMatch = matchRoute(pathname);
  const isAuthRoute = AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );

  // Ruta protegida sin token → Login
  if (routeMatch && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Ruta protegida con restricción de rol
  if (routeMatch && token && routeMatch.roles) {
    const payload = await decodeAndVerifyJwt(token);
    if (!payload || !routeMatch.roles.includes(payload.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Ruta de auth con token → Dashboard
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Raíz "/" → Redirigir según sesión
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(token ? '/dashboard' : '/login', request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)).*)',
  ],
};
