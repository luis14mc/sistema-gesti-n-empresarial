import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { getDeleteEligibility } from '@/modules/users/application/user-delete-eligibility-service';
import { handleUsersApiError } from '@/modules/users/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await ctx.params;
    const { organizationId } = await authorizeOrganization(req, requestId, 'users.read');
    const result = await getDeleteEligibility({
      organizationId,
      targetUserId: id,
      actorUserId: req.user!.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleUsersApiError(error, requestId, 'Error al evaluar eliminación');
  }
}

export const GET = withAuth(getHandler);
