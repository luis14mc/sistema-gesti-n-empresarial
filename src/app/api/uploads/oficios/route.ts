import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { saveOficioDocument } from '@/lib/oficios-storage';
import { oficioOrganizationFailure } from '@/modules/oficios/presentation/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.attachments');

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Debes seleccionar un archivo para subir' },
        { status: 400 }
      );
    }

    const attachment = await saveOficioDocument(file, organization.organizationId);

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const organizationResponse = oficioOrganizationFailure(error, requestId);
    if (organizationResponse) return organizationResponse;
    const message = error instanceof Error ? error.message : 'Error al subir el archivo';
    console.error('Error en upload de oficios:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const POST = withAuth(postHandler);
