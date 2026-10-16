import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { undoOficioImportBatch } from '@/modules/oficios/import-export/oficios-import';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function postHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const { id } = await context.params;
    const result = await undoOficioImportBatch({
      organizationId: organization.organizationId,
      batchId: id,
      userId: organization.userId,
    });

    await createAuditRecord({
      title: 'Deshacer lote de importación de correspondencia',
      description: `Lote ${id}: ${result.archivedOficios} oficios archivados y correlativos restaurados.`,
      module: 'OFICIOS',
      category: 'DELETE',
      action: 'OFICIO_IMPORT_BATCH_UNDO',
      userId: organization.userId,
      organizationId: organization.organizationId,
      requestId,
      metadata: result,
    });

    return apiSuccess(result, { requestId });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    const code = error instanceof Error ? error.message : '';
    const messages: Record<string, string> = {
      BATCH_NOT_FOUND: 'Lote no encontrado.',
      BATCH_NOT_FINISHED: 'El lote aún no ha finalizado.',
      BATCH_EMPTY: 'El lote no tiene oficios importados.',
      BATCH_MODIFIED: 'No se puede deshacer: uno o más oficios fueron modificados después de la importación.',
    };
    if (messages[code]) {
      return apiFailure(code, messages[code], { requestId, status: 409, details: [], stage: 'UNDO_BATCH' });
    }
    console.error('[OFICIOS IMPORT UNDO ERROR]', { requestId, error });
    return apiFailure('UNDO_FAILED', 'No se pudo deshacer el lote.', { requestId, status: 500, details: [], stage: 'UNDO_BATCH' });
  }
}

export const POST = withAuth(postHandler);
