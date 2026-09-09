import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { EQUIPMENT_DOCUMENT_TYPES } from '@/lib/equipment-document-types';
import { saveEquipmentDocument } from '@/lib/equipment-storage';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { equipmentApiFailure } from '@/modules/equipment/tenant';
import { apiFailure } from '@/platform/api/response';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'equipment.update');

    const formData = await req.formData();
    const file = formData.get('file');
    const tipoDocumento = formData.get('tipoDocumento');
    const subfolder = formData.get('subfolder');

    if (!file || !(file instanceof File)) {
      return apiFailure('EQUIPMENT_FILE_REQUIRED', 'Debes seleccionar un archivo', { requestId, status: 400 });
    }

    const document = await saveEquipmentDocument(file, {
      organizationId: organization.organizationId,
      tipoDocumento: typeof tipoDocumento === 'string' ? tipoDocumento : null,
      subfolder: typeof subfolder === 'string' ? subfolder : null,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al subir el archivo';
    console.error('Error en upload de equipos:', error);
    if (isOrganizationContextError(error)) return equipmentApiFailure(error, requestId, { code: 'EQUIPMENT_UPLOAD_FAILED', message, stage: 'UPLOAD_EQUIPMENT_DOCUMENT' });
    return apiFailure('INVALID_EQUIPMENT_UPLOAD', message, { requestId, status: 400, details: { tiposPermitidos: EQUIPMENT_DOCUMENT_TYPES }, stage: 'UPLOAD_EQUIPMENT_DOCUMENT' });
  }
}

export const POST = withAuth(postHandler);
