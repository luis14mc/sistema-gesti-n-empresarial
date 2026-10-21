import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { payrollFailure } from '@/modules/payroll/application/http';
import { sendPayslipEmailsSchema } from '@/modules/payroll/application/schemas';
import { sendPayslipEmails } from '@/modules/payroll/application/payslip-email-service';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.generate');
    const body = sendPayslipEmailsSchema.parse(await req.json());
    const summary = await sendPayslipEmails({
      organizationId,
      userId,
      year: body.year,
      month: body.month,
      employeeIds: body.employeeIds,
      force: body.force,
      failedOnly: body.failedOnly,
      requestId,
    });
    return apiSuccess(summary, {
      requestId,
      status: summary.completed ? 200 : 202,
    });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
