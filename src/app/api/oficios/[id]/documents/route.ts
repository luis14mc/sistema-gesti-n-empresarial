import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  assertAttachDocumentFile,
  attachDocumentsUseCase,
} from '@/modules/oficios/application/attach-documents';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function postHandler(req: AuthenticatedRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const { id } = await context.params;
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.attachments');
    const formData = await req.formData();
    const file = formData.get('file');
    assertAttachDocumentFile(file);
    const documentType = (formData.get('documentType') as string) || 'ANEXO';
    const isPrimary = formData.get('isPrimary') === 'true';

    const result = await attachDocumentsUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      oficioId: id,
      file,
      documentType,
      isPrimary,
    });

    return NextResponse.json(
      { document: result.document, pdfOptimizationSummary: result.pdfOptimizationSummary },
      { status: result.status },
    );
  } catch (error) {
    console.error('Error en POST /api/oficios/[id]/documents:', error);
    return handleOficiosApiError(error, requestId, 'Error al subir documento');
  }
}

export const POST = withAuth(postHandler);
