import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { getEquipmentDeviceLicenses } from '@/modules/software-licenses/application/service';
import { licenseFailure } from '@/modules/software-licenses/presentation/http';

async function getHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ equipmentId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'software-licenses.read');
    const { equipmentId } = await params;
    const items = await getEquipmentDeviceLicenses(equipmentId, organizationId);
    return apiSuccess({ items }, { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
