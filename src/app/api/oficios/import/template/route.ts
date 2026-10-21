import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { buildOficioImportTemplateUseCase } from '@/modules/oficios/application/import-template';
import { apiFailure } from '@/platform/api/response';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const body = await buildOficioImportTemplateUseCase(organization.organizationId);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Plantilla_Correspondencia_CNI.xlsx"',
        'Cache-Control': 'no-store',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    console.error('[OFICIOS IMPORT TEMPLATE ERROR]', { requestId, error });
    return apiFailure('OFICIO_TEMPLATE_FAILED', 'No se pudo generar la plantilla.', {
      requestId,
      status: 500,
      details: [],
      stage: 'GENERATE_TEMPLATE',
    });
  }
}

export const GET = withAuth(getHandler);
