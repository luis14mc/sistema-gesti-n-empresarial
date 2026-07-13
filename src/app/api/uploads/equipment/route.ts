import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { EQUIPMENT_DOCUMENT_TYPES } from '@/lib/equipment-document-types';
import { saveEquipmentDocument } from '@/lib/equipment-storage';
import type { Role } from '@/types';

async function postHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;

    if (!canAccess(role, 'equipment', 'update') && !canAccess(role, 'assignments', 'update')) {
      return NextResponse.json({ error: 'Sin permisos para subir documentos' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const tipoDocumento = formData.get('tipoDocumento');
    const subfolder = formData.get('subfolder');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Debes seleccionar un archivo' }, { status: 400 });
    }

    const document = await saveEquipmentDocument(file, {
      tipoDocumento: typeof tipoDocumento === 'string' ? tipoDocumento : null,
      subfolder: typeof subfolder === 'string' ? subfolder : null,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al subir el archivo';
    console.error('Error en upload de equipos:', error);
    return NextResponse.json(
      {
        error: message,
        tiposPermitidos: EQUIPMENT_DOCUMENT_TYPES,
      },
      { status: 400 }
    );
  }
}

export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
