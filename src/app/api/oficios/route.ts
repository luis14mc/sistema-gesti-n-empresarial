import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  createRateLimiter,
  RATE_LIMIT_RULES,
  rateLimitHeaders,
} from '@/platform/security/authentication/rate-limit';
import { createOficioUseCase } from '@/modules/oficios/application/create-oficio';
import { listOficiosUseCase } from '@/modules/oficios/application/list-oficios';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

const oficioCreateLimiter = createRateLimiter({
  ...RATE_LIMIT_RULES.MUTATION,
  max: 30,
});

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.read');
    const { searchParams } = new URL(req.url);
    const result = await listOficiosUseCase({
      organizationId: organization.organizationId,
      userRole: req.user!.role,
      userId: req.user!.userId,
      userEmail: req.user!.email,
      searchParams,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener oficios:', error);
    return handleOficiosApiError(error, requestId, 'Error al obtener oficios');
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.create');

    const rateKey = `${req.user!.userId}:${organization.organizationId}`;
    const limitResult = oficioCreateLimiter.check(rateKey);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes, intente nuevamente en un momento.' },
        { status: 429, headers: rateLimitHeaders(limitResult) },
      );
    }

    const body = await req.json();
    const result = await createOficioUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      body,
    });
    return NextResponse.json({ oficio: result.oficio }, { status: result.status });
  } catch (error) {
    console.error('Error al crear oficio:', error);
    return handleOficiosApiError(error, requestId, 'Error al crear oficio');
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
