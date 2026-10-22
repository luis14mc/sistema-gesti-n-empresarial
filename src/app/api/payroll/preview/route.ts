import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { previewPayslip } from '@/modules/payroll/application/payroll-service';
import { payrollFailure } from '@/modules/payroll/application/http';
import { previewPayslipSchema } from '@/modules/payroll/application/schemas';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.view');
    const { searchParams } = new URL(req.url);
    const input = previewPayslipSchema.parse({
      employeeId: searchParams.get('employeeId'),
      payMonth: searchParams.get('payMonth'),
      otro: searchParams.get('otro') ? Number(searchParams.get('otro')) : undefined,
      otroConcepto: searchParams.get('otroConcepto'),
    });
    return apiSuccess(
      await previewPayslip(organizationId, input.employeeId, input.payMonth, {
        otro: input.otro,
        otroConcepto: input.otroConcepto,
      }),
      { requestId },
    );
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.view');
    const body = previewPayslipSchema.parse(await req.json());
    return apiSuccess(
      await previewPayslip(organizationId, body.employeeId, body.payMonth, {
        otro: body.otro,
        otroConcepto: body.otroConcepto,
      }),
      { requestId },
    );
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
