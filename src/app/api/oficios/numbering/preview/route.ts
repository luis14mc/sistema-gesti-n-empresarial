import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import { normalizeOficioDependency } from '@/lib/oficios-numbering';
import { previewOficioNumber } from '@/modules/oficios/infrastructure/numbering';

/**
 * GET /api/oficios/numbering/preview?dependency=CNI&year=2026
 * Returns the next number without consuming the sequence.
 */
async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.create');
    const { searchParams } = new URL(req.url);
    const dependency = normalizeOficioDependency(searchParams.get('dependency') ?? searchParams.get('scope'));
    const year = Number.parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

    const preview = await previewOficioNumber(prisma, {
      organizationId: organization.organizationId,
      dependency,
      year,
    });

    if (!preview) {
      return NextResponse.json(
        {
          error: `No hay configuración activa de numeración para ${dependency} / ${year}`,
          code: 'MISSING_CONFIG',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      dependency,
      year,
      ...preview,
    });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    console.error('Error previewing oficio number:', error);
    return NextResponse.json({ error: 'Error al previsualizar número' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
