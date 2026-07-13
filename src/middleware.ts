import { NextRequest, NextResponse } from 'next/server';
import { routeToAccess } from '@/lib/permissions';

// ============================================
// NEXT.JS MIDDLEWARE — Protección de rutas + RBAC
// Sprint 2: la matriz de permisos vive en lib/permissions.ts (única fuente
// de verdad). Este middleware solo orquesta JWT + redirecciones.
// ============================================

type Role = 'ADMIN' | 'USER' | 'RRHH' | 'IT';

const TOKEN_COOKIE = 'token';
const AUTH_ROUTES = ['/login', '/register'];

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  // Resolver acceso via permissions.ts (única fuente de verdad)
  const access = routeToAccess(pathname);
  const authRoute = isAuthRoute(pathname);

  // 1) Ruta protegida sin token → /login con callback
  if (access && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2) Ruta protegida con restricción de rol
  if (access && token && access.roles) {
    const payload = await decodeAndVerifyJwt(token);
    if (!payload || !access.roles.includes(payload.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 3) Auth route con sesión activa → dashboard
  if (authRoute && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 4) Raíz "/" → según sesión
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
