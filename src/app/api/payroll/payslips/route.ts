import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { generatePayslip, listPayslips } from '@/modules/payroll/application/payroll-service';
import { payrollFailure } from '@/modules/payroll/application/http';
import { generatePayslipSchema } from '@/modules/payroll/application/schemas';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.view');
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const employeeId = searchParams.get('employeeId') ?? undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    return apiSuccess(
      await listPayslips(organizationId, {
        year: year ? parseInt(year, 10) : undefined,
        month: month ? parseInt(month, 10) : undefined,
        employeeId,
        page,
        pageSize,
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
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.generate');
    const body = generatePayslipSchema.parse(await req.json());
    const payslip = await generatePayslip(organizationId, body.employeeId, body.payMonth, userId);
    await createAuditRecord({
      title: 'Recibo de planilla generado',
      description: `Se generó o actualizó un recibo de planilla para el periodo ${body.payMonth}.`,
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId,
      entityId: payslip.id,
      entityType: 'Payslip',
      action: 'PAYROLL_GENERATE',
      requestId,
      metadata: { employeeId: body.employeeId, payMonth: body.payMonth, year: payslip.year, month: payslip.month },
    });
    return apiSuccess(payslip, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
