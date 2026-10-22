import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  listNumberingConfigsUseCase,
  previewNumberingPatternUseCase,
  upsertNumberingConfigUseCase,
} from '@/modules/oficios/application/numbering-api';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.configure');
    const result = await listNumberingConfigsUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing numbering configs:', error);
    return handleOficiosApiError(error, requestId, 'Error al listar numeración');
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.configure');
    const body = await req.json();
    const result = await upsertNumberingConfigUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      organizationRole: organization.role,
      body,
    });

    if (result.kind === 'forbidden') {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 403 });
    }
    if (result.kind === 'bad_request') {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }

    return NextResponse.json({ config: result.config }, { status: result.status });
  } catch (error) {
    console.error('Error saving numbering config:', error);
    return handleOficiosApiError(error, requestId, 'Error al guardar numeración');
  }
}

async function putHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    try {
      await authorizeOrganization(req, requestId, 'oficios.configure');
    } catch {
      await authorizeOrganization(req, requestId, 'oficios.create');
    }

    const body = await req.json();
    const result = previewNumberingPatternUseCase(body);
    if (result.kind === 'invalid') {
      return NextResponse.json({ error: result.error, valid: false }, { status: 400 });
    }
    return NextResponse.json({ valid: true, nextNumber: result.nextNumber });
  } catch (error) {
    return handleOficiosApiError(error, requestId, 'Error al previsualizar');
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
export const PUT = withAuth(putHandler);
