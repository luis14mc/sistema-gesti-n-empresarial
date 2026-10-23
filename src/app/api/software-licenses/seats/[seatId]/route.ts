import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { updateSeatSchema } from '@/modules/software-licenses/presentation/schemas';
import { deleteSeat, updateSeat } from '@/modules/software-licenses/application/service';
import { licenseFailure } from '@/modules/software-licenses/presentation/http';

async function patchHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ seatId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.manage');
    const { seatId } = await params;
    const input = updateSeatSchema.parse(await req.json());
    return apiSuccess(await updateSeat(seatId, input, organizationId, userId), { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

async function deleteHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ seatId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.manage');
    const { seatId } = await params;
    return apiSuccess(await deleteSeat(seatId, organizationId, userId), { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
