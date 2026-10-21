import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { licensesToWorkbook } from '@/modules/software-licenses/infrastructure/excel';
import { listSoftwareSubscriptions } from '@/modules/software-licenses/application/service';
import { licenseFailure } from '@/modules/software-licenses/presentation/http';

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
