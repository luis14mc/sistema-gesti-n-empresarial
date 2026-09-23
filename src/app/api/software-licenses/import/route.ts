import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { readLicenseWorkbook } from '@/lib/software-licenses/excel';
import { importLicenseRows } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

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
