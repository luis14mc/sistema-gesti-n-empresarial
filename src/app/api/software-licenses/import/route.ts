import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { readLicenseWorkbook } from '@/modules/software-licenses/infrastructure/excel';
import { importLicenseRows } from '@/modules/software-licenses/application/service';
import { licenseFailure } from '@/modules/software-licenses/presentation/http';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.manage');
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('MISSING_FILE');
    const rows = await readLicenseWorkbook(Buffer.from(await file.arrayBuffer()));
    return apiSuccess(await importLicenseRows(rows, organizationId, userId), { requestId });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
