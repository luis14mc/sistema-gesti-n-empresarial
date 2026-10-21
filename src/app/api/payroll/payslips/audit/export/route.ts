import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { exportPayslipsAuditPdf } from '@/modules/payroll/application/payroll-service';
import { payrollFailure } from '@/modules/payroll/application/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'payroll.view');
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') ?? undefined;
    const dateFrom = searchParams.get('dateFrom') ?? undefined;
    const dateTo = searchParams.get('dateTo') ?? undefined;

    const { buffer, storageKey, recordCount } = await exportPayslipsAuditPdf(organizationId, {
      search,
      dateFrom,
      dateTo,
    });

    await createAuditRecord({
      title: 'Auditoría de planilla exportada',
      description: `Se exportó un PDF de auditoría con ${recordCount} recibo(s) de planilla.`,
      module: 'MANUAL',
      category: 'PAYROLL',
      userId,
      organizationId,
      action: 'PAYROLL_AUDIT_EXPORT',
      requestId,
      metadata: { storageKey, recordCount, search, dateFrom, dateTo },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="planilla-auditoria-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
