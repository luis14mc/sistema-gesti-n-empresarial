import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { payrollFailure } from '@/modules/payroll/application/http';
import { getPublicSmtpStatus } from '@/platform/email/smtp-config';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    await authorizeOrganization(req, requestId, 'payroll.configure');
    return apiSuccess(getPublicSmtpStatus(), { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
