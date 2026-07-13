import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';

export const DEPRECATED_API_MESSAGES = {
  tickets:
    'El módulo /api/tickets fue retirado del alcance operativo del sistema',
  timeEntries:
    'El módulo /api/time-entries fue retirado del alcance operativo del sistema',
  promotionalItems:
    'El módulo /api/promotional-items fue retirado del alcance operativo del sistema',
  purchases:
    'El módulo /api/purchases fue reemplazado por /api/compras/solicitudes',
} as const;

export function deprecatedApiResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 410 });
}

export function deprecatedApiHandler(message: string) {
  return withAuth(async () => deprecatedApiResponse(message));
}

/** Rutas frontend legacy fuera de alcance — redirigir al dashboard */
export const DEPRECATED_FRONTEND_PREFIXES = [
  '/tickets',
  '/inventory',
  '/time-entries',
] as const;

export function isDeprecatedFrontendPath(pathname: string): boolean {
  return DEPRECATED_FRONTEND_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
