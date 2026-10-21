import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { changeOficioStatusUseCase } from '@/modules/oficios/application/change-oficio-status';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function patchHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.update');
    const { id } = await context.params;
    const body = await req.json();
    const result = await changeOficioStatusUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      oficioId: id,
      nextStatus: body?.status,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en PATCH /api/oficios/[id]/status:', error);
    return handleOficiosApiError(error, requestId, 'Error al cambiar estado');
  }
}

export const PATCH = withAuth(patchHandler);
