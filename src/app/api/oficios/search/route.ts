import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { searchOficiosUseCase } from '@/modules/oficios/application/search-oficios';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.read');
    const { searchParams } = new URL(req.url);
    const result = await searchOficiosUseCase({
      organizationId: organization.organizationId,
      userRole: req.user!.role,
      userId: req.user!.userId,
      userEmail: req.user!.email,
      searchParams,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en /api/oficios/search:', error);
    return handleOficiosApiError(error, requestId, 'Error al buscar oficios');
  }
}

export const GET = withAuth(getHandler);
