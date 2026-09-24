import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { createAuditRecord } from '@/lib/audit';
import { licensesToWorkbook } from '@/lib/software-licenses/excel';
import { listSoftwareSubscriptions } from '@/lib/software-licenses/service';
import { licenseFailure } from '@/lib/software-licenses/http';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId, userId } = await authorizeOrganization(req, requestId, 'software-licenses.export');
    const subscriptions = await listSoftwareSubscriptions(organizationId, {});
    const file = await licensesToWorkbook(subscriptions);
    await createAuditRecord({
      organizationId,
      userId,
      module: 'LICENCIAS',
      category: 'EXPORT',
      action: 'LICENSES_EXPORTED',
      title: 'Licencias exportadas',
      description: `Se exportaron ${subscriptions.length} suscripciones.`,
      entityType: 'SoftwareSubscription',
    });
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    return licenseFailure(error, requestId);
  }
}

export const GET = withAuth(getHandler);
