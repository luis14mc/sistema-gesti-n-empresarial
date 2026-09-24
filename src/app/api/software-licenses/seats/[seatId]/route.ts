import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { updateSeatSchema } from '@/lib/software-licenses/schemas';
import { updateSeat } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

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

export const PATCH = withAuth(patchHandler);
