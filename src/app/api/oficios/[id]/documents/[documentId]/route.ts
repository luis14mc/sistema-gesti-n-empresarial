import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { deleteOficioDocumentUseCase } from '@/modules/oficios/application/delete-oficio-document';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

async function deleteHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const { id, documentId } = await context.params;
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.attachments');
    const result = await deleteOficioDocumentUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      oficioId: id,
      documentId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en DELETE /api/oficios/[id]/documents/[documentId]:', error);
    return handleOficiosApiError(error, requestId, 'Error al eliminar documento');
  }
}

export const DELETE = withAuth(deleteHandler);
