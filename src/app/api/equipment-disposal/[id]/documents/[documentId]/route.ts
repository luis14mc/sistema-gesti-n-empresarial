import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import { disposalDocumentsService } from '@/modules/equipment-disposal/application/documents-service';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  return runDisposalRoute(request, 'documents.delete', async ({ context, requestId }) => {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.update');
    const { id, documentId } = await params;
    await disposalDocumentsService.remove(context, id, documentId, requestId);
    return apiSuccess({ deleted: true }, { requestId });
  });
}
export const DELETE = withAuth(handler);
