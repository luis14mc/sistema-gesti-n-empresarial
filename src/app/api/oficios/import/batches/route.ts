import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { listImportBatchesUseCase } from '@/modules/oficios/application/list-import-batches';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const dynamic = 'force-dynamic';

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const batchId = searchParams.get('batchId');

    const result = await listImportBatchesUseCase({
      organizationId: organization.organizationId,
      limit,
      batchId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listando batches:', error);
    return handleOficiosApiError(error, requestId, 'Error al listar batches');
  }
}

export const GET = withAuth(getHandler);
