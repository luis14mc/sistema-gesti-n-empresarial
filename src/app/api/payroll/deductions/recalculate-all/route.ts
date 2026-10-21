import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { payrollFailure } from '@/modules/payroll/application/http';
import { countActivePayrollEmployees } from '@/modules/payroll/application/payroll-service';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const employeeCount = await countActivePayrollEmployees(organizationId);
    await createAuditRecord({
      title: 'Recálculo ISR/IHSS solicitado',
      description:
        'En SGE las deducciones se calculan al generar o previsualizar boletas; no se persisten en el empleado.',
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId,
      action: 'PAYROLL_DEDUCTIONS_RECALC',
      requestId,
      metadata: { employeeCount },
    });
    return apiSuccess(
      {
        employeeCount,
        message:
          'Las deducciones ISR e IHSS se recalculan automáticamente al previsualizar o generar boletas.',
      },
      { requestId },
    );
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
