import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { previewOficioNumberUseCase } from '@/modules/oficios/application/numbering-preview';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.create');
    const { searchParams } = new URL(req.url);
    const result = await previewOficioNumberUseCase({
      organizationId: organization.organizationId,
      dependencyRaw: searchParams.get('dependency'),
      scopeRaw: searchParams.get('scope'),
      yearRaw: searchParams.get('year'),
    });

    if (result.kind === 'missing_config') {
      return NextResponse.json(
        {
          error: `No hay configuración activa de numeración para ${result.dependency} / ${result.year}`,
          code: 'MISSING_CONFIG',
        },
        { status: 404 },
      );
    }

    const { kind: _k, ...payload } = result;
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error previewing oficio number:', error);
    return handleOficiosApiError(error, requestId, 'Error al previsualizar número');
  }
}

export const GET = withAuth(getHandler);
