import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { payrollFailure } from '@/modules/payroll/application/http';
import { previewPayrollDeductionsForSalary } from '@/modules/payroll/application/payroll-service';
import { isrPreviewCalcSchema } from '@/modules/payroll/application/schemas';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const body = isrPreviewCalcSchema.parse(await req.json());
    const payMonth =
      body.payMonth
      ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const result = await previewPayrollDeductionsForSalary(organizationId, {
      monthlySalary: body.monthlySalary,
      hireDate: body.hireDate,
      payMonth,
    });
    return apiSuccess(result, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
