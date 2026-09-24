import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { assignSeatSchema } from '@/lib/software-licenses/schemas';
import { assignSeat } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

async function postHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ seatId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.assign');
    const { seatId } = await params;
    const input = assignSeatSchema.parse(await req.json());
    return apiSuccess(await assignSeat(seatId, input.employeeId, organizationId, userId, input.notes, input.replaceAssignmentId), { requestId, status: 201 });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
