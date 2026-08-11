import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { listAvailableReports } from '@/modules/reporting/application/services/report-catalog';
import { runReportingRoute } from '@/modules/reporting/presentation/http';
import { apiSuccess } from '@/platform/api/response';

async function handler(request: AuthenticatedRequest) {
  return runReportingRoute(request, 'catalog.list', async ({ context, requestId }) => {
    return apiSuccess({ reports: listAvailableReports(context.role) }, { requestId });
  });
}

export const GET = withAuth(handler);
