import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { updateOficioSignerUseCase } from '@/modules/oficios/application/oficio-signers';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

type RouteContext = { params: Promise<{ id: string }> };

async function patchHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.configure');
    const { id } = await context.params;
    const body = await req.json();
    const result = await updateOficioSignerUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      signerId: id,
      body,
    });
    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Firmante no encontrado' }, { status: 404 });
    }
    if (result.kind === 'validation_error') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ signer: result.signer });
  } catch (error) {
    return handleOficiosApiError(error, requestId, 'Error al actualizar firmante');
  }
}

export const PATCH = withAuth(patchHandler);
