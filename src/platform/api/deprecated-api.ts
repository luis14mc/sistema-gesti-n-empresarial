import { NextResponse } from 'next/server';
import { withAuth } from '@/platform/api/with-auth';
export {
  DEPRECATED_FRONTEND_PREFIXES,
  isDeprecatedFrontendPath,
} from '@/platform/api/deprecated-frontend-paths';

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
