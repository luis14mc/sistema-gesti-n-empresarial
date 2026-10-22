import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { payrollFailure } from '@/modules/payroll/application/http';
import { verifySmtpAndSendTestEmail } from '@/modules/payroll/application/payslip-email-service';
import { findUserEmail } from '@/modules/payroll/application/smtp-test-recipient';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const toEmail = (await findUserEmail(userId))?.trim();
    if (!toEmail) {
      return payrollFailure(new Error('USER_EMAIL_MISSING'), requestId);
    }
    await verifySmtpAndSendTestEmail(organizationId, toEmail);
    return apiSuccess({ ok: true, sentTo: toEmail }, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
