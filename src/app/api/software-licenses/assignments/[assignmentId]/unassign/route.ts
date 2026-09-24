import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { unassignSeat } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

async function postHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.assign');
    const { assignmentId } = await params;
    return apiSuccess(await unassignSeat(assignmentId, organizationId, userId), { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
