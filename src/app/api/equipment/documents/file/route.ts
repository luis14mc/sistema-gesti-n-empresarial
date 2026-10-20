import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getStorage } from '@/lib/storage';
import { isEquipmentDocumentKeyForOrganization } from '@/lib/equipment-document-access';
import { UPLOAD_FILE_SECURITY_HEADERS } from '@/lib/upload-security-headers';
import { equipmentApiFailure } from '@/modules/equipment/tenant';
import { authorizeOrganization } from '@/platform/security/authorization/http';

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.read');
    const key = new URL(req.url).searchParams.get('key');

    if (!isEquipmentDocumentKeyForOrganization(key, organizationId)) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const extension = key.split('.').pop()?.toLowerCase() ?? '';
    const mimeHint = MIME_BY_EXTENSION[extension];
    if (!mimeHint) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    let object;
    try {
      object = await getStorage().get(key, mimeHint);
    } catch {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const filename = key.split('/').pop() || 'documento';
    return new NextResponse(new Uint8Array(object.buffer), {
      status: 200,
      headers: {
        // Solo PDF/PNG/JPEG: se fuerza el MIME por extensión, nunca el del storage.
        'Content-Type': mimeHint,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        ...UPLOAD_FILE_SECURITY_HEADERS,
      },
    });
  } catch (error) {
    return equipmentApiFailure(error, requestId, {
      code: 'EQUIPMENT_DOCUMENT_READ_FAILED',
      message: 'Error al obtener el documento',
      stage: 'READ_EQUIPMENT_DOCUMENT',
    });
  }
}

export const GET = withAuth(getHandler);
