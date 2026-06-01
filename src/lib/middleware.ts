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
    try {
      const token =
        req.headers.get('authorization')?.replace('Bearer ', '') ||
        req.cookies.get('token')?.value;

      if (!token) {
        return NextResponse.json(
          { error: 'No autorizado' },
          { status: 401 }
        );
      }

      const payload = verifyToken(token);

      if (!payload) {
        return NextResponse.json(
          { error: 'Token inválido' },
          { status: 401 }
        );
      }

      // Verificar roles permitidos
      if (allowedRoles && !allowedRoles.includes(payload.role)) {
        return NextResponse.json(
          { error: 'No tienes permisos para esta acción' },
          { status: 403 }
        );
      }

      req.user = payload;
      return await handler(req, context);
    } catch (error) {
      console.error('Error en middleware de autenticación:', error);
      return NextResponse.json(
        { error: 'Error de autenticación' },
        { status: 401 }
      );
    }
  };
}
