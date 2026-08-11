import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { EQUIPMENT_DOCUMENT_TYPES } from '@/lib/equipment-document-types';
import { saveEquipmentDocument } from '@/lib/equipment-storage';
import type { Role } from '@/types';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { equipmentApiFailure } from '@/modules/equipment/tenant';
import { apiFailure } from '@/platform/api/response';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await requireOrganizationContext(req, requestId);
    const role = req.user!.role as Role;

    if (!canAccess(role, 'equipment', 'update') && !canAccess(role, 'assignments', 'update')) {
      return apiFailure('EQUIPMENT_UPLOAD_FORBIDDEN', 'Sin permisos para subir documentos', { requestId, status: 403 });
    }

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

export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
