import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  importOficiosUseCase,
  parseImportPayload,
} from '@/modules/oficios/application/import-oficios';
import { handleOficiosApiError } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

export const dynamic = 'force-dynamic';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const formData = await req.formData();
    const payload = parseImportPayload(formData.get('payload'));
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    const force = req.nextUrl.searchParams.get('force') === 'true';

    const result = await importOficiosUseCase({
      organizationId: organization.organizationId,
      actorUserId: req.user!.userId,
      actorEmail: req.user!.email,
      payload,
      file,
      force,
    });

    return NextResponse.json(
      {
        oficio: result.oficio,
        duplicates: result.duplicates,
        warnings: result.warnings,
      },
      { status: result.status },
    );
  } catch (error) {
    console.error('Error en /api/oficios/import:', error);
    return handleOficiosApiError(error, requestId, 'Error al importar oficio');
  }
}

export const POST = withAuth(postHandler);
