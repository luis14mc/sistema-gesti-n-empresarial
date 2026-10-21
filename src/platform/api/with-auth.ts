import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/platform/security/authentication/auth';
import { assertTokenSessionStillValid } from '@/platform/security/authentication/session-validity';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { sessionRoleMatchesAllowlist } from '@/platform/security/authorization/roles';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/** Rutas API permitidas mientras el usuario debe cambiar su contraseña. */
const PASSWORD_CHANGE_ALLOWED_API_PATHS = [
  '/api/auth/me',
  '/api/auth/password',
  '/api/auth/refresh-session',
  '/api/auth/logout',
];

function isPasswordChangeAllowedPath(req: AuthenticatedRequest): boolean {
  let pathname = '';
  try {
    pathname = req.nextUrl?.pathname ?? new URL(req.url).pathname;
  } catch {
    return false;
  }
  return PASSWORD_CHANGE_ALLOWED_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Middleware de autenticación para route handlers.
 * Soporta handlers con y sin params (rutas dinámicas [id]).
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>,
  allowedRoles?: string[]
) {
  return async (req: AuthenticatedRequest, context?: any): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();
    try {
      const token =
        req.headers.get('authorization')?.replace('Bearer ', '') ||
        req.cookies.get('token')?.value;

      if (!token) {
        return NextResponse.json(
          { success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Debe iniciar sesión para continuar.' }, requestId },
          { status: 401, headers: { 'x-request-id': requestId } }
        );
      }

      const payload = verifyToken(token);

      if (!payload) {
        return NextResponse.json(
          { success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'La sesión no es válida.' }, requestId },
          { status: 401, headers: { 'x-request-id': requestId } }
        );
      }

      const sessionValid = await assertTokenSessionStillValid(payload);
      if (!sessionValid) {
        return NextResponse.json(
          { success: false, error: { code: 'SESSION_REVOKED', message: 'La sesión expiró. Inicie sesión de nuevo.' }, requestId },
          { status: 401, headers: { 'x-request-id': requestId } }
        );
      }

      // Cambio de contraseña obligatorio: el middleware Edge solo redirige páginas;
      // las APIs también deben bloquearse (auditoría 2026-10-19, hardening 1).
      if (payload.mustChangePassword && !isPasswordChangeAllowedPath(req)) {
        return NextResponse.json(
          { success: false, error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Debe cambiar su contraseña antes de continuar.' }, requestId },
          { status: 403, headers: { 'x-request-id': requestId } }
        );
      }

      // Verificar roles permitidos
      if (allowedRoles && !sessionRoleMatchesAllowlist(payload.role, allowedRoles)) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'No tiene permisos para esta acción.' }, requestId },
          { status: 403, headers: { 'x-request-id': requestId } }
        );
      }

      req.user = payload;
      return await handler(req, context);
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return NextResponse.json(
          { success: false, error: { code: 'PERMISSION_DENIED', message: error.message }, requestId },
          { status: 403, headers: { 'x-request-id': requestId } }
        );
      }
      if (isOrganizationContextError(error)) {
        return NextResponse.json(
          { success: false, error: { code: error.code, message: error.message }, requestId },
          { status: error.status, headers: { 'x-request-id': requestId } }
        );
      }
      console.error('Error en middleware de autenticación:', error);
      return NextResponse.json(
        { success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'No se pudo validar la sesión.' }, requestId },
        { status: 401, headers: { 'x-request-id': requestId } }
      );
    }
  };
}
