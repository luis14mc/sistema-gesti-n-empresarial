import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { listPayrollEmployees } from '@/modules/payroll/application/payroll-service';
import { payrollFailure } from '@/modules/payroll/application/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.view');
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? undefined;
    const payrollEnabledParam = searchParams.get('payrollEnabled');
    const payrollEnabled =
      payrollEnabledParam === null || payrollEnabledParam === ''
        ? undefined
        : payrollEnabledParam === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const previewPayMonth = searchParams.get('previewPayMonth') ?? undefined;
    return apiSuccess(
      await listPayrollEmployees(organizationId, {
        search,
        payrollEnabled,
        page,
        pageSize,
        previewPayMonth,
      }),
      { requestId },
    );
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
