import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
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

      // Verificar roles permitidos
      if (allowedRoles && !allowedRoles.includes(payload.role)) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'No tiene permisos para esta acción.' }, requestId },
          { status: 403, headers: { 'x-request-id': requestId } }
        );
      }

      req.user = payload;
      return await handler(req, context);
    } catch (error) {
      console.error('Error en middleware de autenticación:', error);
      return NextResponse.json(
        { success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'No se pudo validar la sesión.' }, requestId },
        { status: 401, headers: { 'x-request-id': requestId } }
      );
    }
  };
}
