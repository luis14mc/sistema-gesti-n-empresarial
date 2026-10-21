import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { batchGeneratePayslips } from '@/modules/payroll/application/payroll-service';
import { payrollFailure } from '@/modules/payroll/application/http';
import { batchPayslipSchema } from '@/modules/payroll/application/schemas';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.generate');
    const body = batchPayslipSchema.parse(await req.json());
    const result = await batchGeneratePayslips(
      organizationId,
      body.payMonth,
      body.employeeIds,
      userId,
      body.employeeAdjustments,
      { deliveryMode: body.deliveryMode, requestId },
    );
    await createAuditRecord({
      title: 'Generación masiva de planilla',
      description: `Se procesó la generación masiva para ${body.payMonth}.`,
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId,
      action: 'PAYROLL_BATCH_GENERATE',
      requestId,
      metadata: {
        payMonth: body.payMonth,
        employeeCount: result.results.length,
        succeeded: result.succeeded,
        failed: result.failed,
      },
    });
    return apiSuccess(result, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const POST = withAuth(postHandler);
