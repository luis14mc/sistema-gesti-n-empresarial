import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  createOficioSignerUseCase,
  listOficioSignersUseCase,
} from '@/modules/oficios/application/oficio-signers';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';

async function authorizeReadOrConfigure(req: AuthenticatedRequest, requestId: string) {
  try {
    return await authorizeOrganization(req, requestId, 'oficios.configure');
  } catch (error) {
    if (!(error instanceof PermissionDeniedError)) throw error;
    return authorizeOrganization(req, requestId, 'oficios.read');
  }
}

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeReadOrConfigure(req, requestId);
    const { searchParams } = new URL(req.url);
    const result = await listOficioSignersUseCase({
      organizationId: organization.organizationId,
      dependency: searchParams.get('dependency'),
      activeOnly: searchParams.get('active') !== 'false',
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleOficiosApiError(error, requestId, 'Error al listar firmantes');
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.configure');
    const body = await req.json();
    const result = await createOficioSignerUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      body,
    });
    if (result.kind === 'validation_error') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ signer: result.signer }, { status: 201 });
  } catch (error) {
    return handleOficiosApiError(error, requestId, 'Error al crear firmante');
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
