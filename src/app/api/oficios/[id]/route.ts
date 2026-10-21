import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { deleteOficioUseCase } from '@/modules/oficios/application/delete-oficio';
import { getOficioUseCase } from '@/modules/oficios/application/get-oficio';
import { updateOficioUseCase } from '@/modules/oficios/application/update-oficio';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

type RouteContext = { params: Promise<{ id: string }> };

async function getHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const { id } = await context.params;
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.read');
    const result = await getOficioUseCase({
      organizationId: organization.organizationId,
      actorRole: req.user!.role,
      actorUserId: req.user!.userId,
      actorEmail: req.user!.email,
      oficioId: id,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener oficio:', error);
    return handleOficiosApiError(error, requestId, 'Error al obtener oficio');
  }
}

async function patchHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const { id } = await context.params;
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.update');
    const body = await req.json();
    const result = await updateOficioUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      oficioId: id,
      body,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al actualizar oficio:', error);
    return handleOficiosApiError(error, requestId, 'Error al actualizar oficio');
  }
}

async function deleteHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const { id } = await context.params;
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.deactivate');
    const result = await deleteOficioUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      oficioId: id,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al eliminar oficio:', error);
    return handleOficiosApiError(error, requestId, 'Error al eliminar oficio');
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
