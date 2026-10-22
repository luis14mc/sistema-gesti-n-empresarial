import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { getPayrollEmployeeDetail, patchPayrollEmployee } from '@/modules/payroll/application/payroll-service';
import { payrollFailure } from '@/modules/payroll/application/http';
import { patchPayrollEmployeeSchema } from '@/modules/payroll/application/schemas';

async function getHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.view');
    const { id } = await params;
    return apiSuccess(await getPayrollEmployeeDetail(organizationId, id), { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

async function patchHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const { id } = await params;
    const body = patchPayrollEmployeeSchema.parse(await req.json());
    const employee = await patchPayrollEmployee(organizationId, id, body);
    await createAuditRecord({
      title: 'Datos de planilla actualizados',
      description: `Se actualizó la configuración de planilla del empleado ${employee.fullName}.`,
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId,
      entityId: id,
      entityType: 'Employee',
      action: 'PAYROLL_EMPLOYEE_UPDATE',
      requestId,
      metadata: {
        payrollEnabled: body.payrollEnabled,
        hasSalaryChange: body.monthlySalary !== undefined,
        hasDeductionChange: body.otherDeduction !== undefined || body.otherDeductionNote !== undefined,
      },
    });
    return apiSuccess(employee, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
