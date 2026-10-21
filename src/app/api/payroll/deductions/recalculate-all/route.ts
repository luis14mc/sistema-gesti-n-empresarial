import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { payrollFailure } from '@/modules/payroll/application/http';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const employeeCount = await prisma.employee.count({
      where: { organizationId, isActive: true, payrollEnabled: true },
    });
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
