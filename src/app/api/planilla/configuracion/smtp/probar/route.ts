import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { payrollFailure } from '@/modules/payroll/application/http';
import { verifySmtpAndSendTestEmail } from '@/modules/payroll/application/payslip-email-service';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const toEmail = user?.email?.trim();
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
