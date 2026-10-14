import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { listIsrBracketRecords, replaceIsrBracketRecords } from '@/modules/payroll/application/settings-loader';
import { payrollFailure } from '@/modules/payroll/application/http';
import { isrBracketsPutSchema } from '@/modules/payroll/application/schemas';
import { PAYROLL_YEAR } from '@/modules/payroll/domain';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.view');
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || String(PAYROLL_YEAR), 10);
    return apiSuccess({ year, brackets: await listIsrBracketRecords(organizationId, year) }, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

async function putHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const body = isrBracketsPutSchema.parse(await req.json());
    const brackets = await replaceIsrBracketRecords(organizationId, body.year, body.brackets);
    await createAuditRecord({
      title: 'Tabla ISR actualizada',
      description: `Se reemplazó la tabla ISR para el año ${body.year}.`,
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId,
      action: 'PAYROLL_ISR_UPDATE',
      requestId,
      metadata: { year: body.year, bracketCount: body.brackets.length },
    });
    return apiSuccess({ year: body.year, brackets }, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
