import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { getPayslipPdfBuffer } from '@/modules/payroll/application/payroll-service';
import { payrollFailure } from '@/modules/payroll/application/http';

async function getHandler(req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'payroll.view');
    const { id } = await params;
    const { buffer, filename } = await getPayslipPdfBuffer(organizationId, id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    return payrollFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
