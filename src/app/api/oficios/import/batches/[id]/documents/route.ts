import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { attachBatchDocumentsUseCase } from '@/modules/oficios/application/attach-batch-documents';
import {
  handleImportBatchDocumentsApiError,
} from '@/modules/oficios/presentation/http';
import { apiSuccess } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';

type RouteContext = { params: Promise<{ id: string }> };

async function postHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const { id: batchId } = await context.params;
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const form = await req.formData();
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    const assignmentsRaw = form.get('assignments');
    let manualAssignments: Array<{ fileName: string; oficioId: string }> = [];
    if (typeof assignmentsRaw === 'string' && assignmentsRaw.trim()) {
      manualAssignments = JSON.parse(assignmentsRaw) as Array<{ fileName: string; oficioId: string }>;
    }

    const result = await attachBatchDocumentsUseCase({
      organizationId: organization.organizationId,
      actorUserId: organization.userId,
      batchId,
      files,
      manualAssignments,
    });

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleImportBatchDocumentsApiError(error, requestId);
  }
}

export const POST = withAuth(postHandler);
