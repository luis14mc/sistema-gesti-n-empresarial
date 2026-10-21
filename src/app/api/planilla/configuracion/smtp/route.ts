import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { payrollFailure } from '@/modules/payroll/application/http';
import { payrollSmtpSettingsPutSchema } from '@/modules/payroll/application/schemas';
import {
  getPayrollSmtpPublicSettings,
  upsertPayrollSmtpSettings,
} from '@/modules/payroll/application/payroll-smtp-settings-service';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    return apiSuccess(await getPayrollSmtpPublicSettings(organizationId), { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

async function putHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.configure');
    const body = payrollSmtpSettingsPutSchema.parse(await req.json());
    await upsertPayrollSmtpSettings(organizationId, userId, {
      host: body.host,
      port: body.port,
      username: body.username,
      password: body.password,
      senderName: body.senderName,
      fromAddress: body.fromAddress,
      replyTo: body.replyTo,
    });
    const publicSettings = await getPayrollSmtpPublicSettings(organizationId);
    await createAuditRecord({
      title: 'Configuración SMTP de planilla actualizada',
      description: 'Se actualizaron los parámetros SMTP del módulo de planilla.',
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId,
      action: 'PAYROLL_SMTP_UPDATE',
      requestId,
      metadata: {
        host: body.host,
        port: body.port,
        username: body.username,
        senderName: body.senderName,
        fromAddress: body.fromAddress,
        replyTo: body.replyTo ?? null,
        passwordUpdated: Boolean(body.password?.trim()),
        passwordConfigured: publicSettings.passwordConfigured,
      },
    });
    return apiSuccess(publicSettings, { requestId });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
