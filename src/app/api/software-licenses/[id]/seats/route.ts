import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { createSeatSchema } from '@/lib/software-licenses/schemas';
import { createSeat } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

async function postHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.manage');
    const { id } = await params;
    const input = createSeatSchema.parse(await req.json());
    return apiSuccess(await createSeat(id, input, organizationId, userId), { requestId, status: 201 });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
