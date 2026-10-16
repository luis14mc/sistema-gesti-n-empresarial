import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { apiFailure } from '@/platform/api/response';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { buildOficioImportTemplate } from '@/modules/oficios/import-export/oficios-template';
import type { OficioDependency } from '@/lib/oficios-numbering';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const configs = await prisma.oficioNumberingConfig.findMany({
      where: { organizationId: organization.organizationId, isActive: true },
      select: { dependency: true },
      distinct: ['dependency'],
    });
    const dependencies = configs.map((item) => item.dependency as OficioDependency);
    const body = await buildOficioImportTemplate(dependencies);
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
