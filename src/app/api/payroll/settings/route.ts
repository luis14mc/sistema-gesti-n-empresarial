import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { getPayrollSettingsRecord, updatePayrollSettingsRecord } from '@/modules/payroll/application/settings-loader';
import { payrollFailure } from '@/modules/payroll/application/http';
import { payrollSettingsPatchSchema } from '@/modules/payroll/application/schemas';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.view');
    return apiSuccess(await getPayrollSettingsRecord(organizationId), { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

async function patchHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const body = payrollSettingsPatchSchema.parse(await req.json());
    const settings = await updatePayrollSettingsRecord(organizationId, body, userId);
    await createAuditRecord({
      title: 'Parámetros de planilla actualizados',
      description: 'Se modificaron los parámetros globales de planilla (IHSS/ISR).',
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId,
      action: 'PAYROLL_SETTINGS_UPDATE',
      requestId,
      metadata: { fields: Object.keys(body) },
    });
    return apiSuccess(settings, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
