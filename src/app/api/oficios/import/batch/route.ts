import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import {
  parseImportBatchPayload,
  processImportBatchUseCase,
} from '@/modules/oficios/application/process-import-batch';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const dynamic = 'force-dynamic';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const formData = await req.formData();
    const payload = parseImportBatchPayload(formData.get('payload'));
    const files = formData.getAll('files').filter((f): f is File => f instanceof File);

    const result = await processImportBatchUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      items: payload.items,
      files,
      notes: payload.notes,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en /api/oficios/import/batch:', error);
    return handleOficiosApiError(error, requestId, 'Error al procesar el batch');
  }
}

export const POST = withAuth(postHandler);
