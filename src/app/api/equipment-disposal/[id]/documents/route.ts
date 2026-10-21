import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiSuccess } from '@/platform/api/response';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import { disposalDocumentsService } from '@/modules/equipment-disposal/application/documents-service';

async function getHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'documents.list', async ({ context, requestId }) => {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.read');
    const { id } = await params;
    const documents = await disposalDocumentsService.list(context, id);
    return apiSuccess(documents, { requestId });
  });
}

async function postHandler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'documents.upload', async ({ context, requestId }) => {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.update');
    const { id } = await params;
    await disposalDocumentsService.assertUploadAllowed(context, id);
    const file = (await request.formData()).get('file');
    const document = await disposalDocumentsService.upload(context, id, file, requestId);
    return apiSuccess(document, { requestId, status: 201 });
  });
}
export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
