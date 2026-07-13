import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
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
    const subfolder = (formData.get('subfolder') as string) || 'general';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Debes seleccionar un archivo' }, { status: 400 });
    }

    const allowed = ['assignments', 'returns', 'maintenance', 'general'];
    const folder = allowed.includes(subfolder)
      ? (subfolder as 'assignments' | 'returns' | 'maintenance' | 'general')
      : 'general';

    const document = await saveEquipmentDocument(file, folder);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al subir el archivo';
    console.error('Error en upload de equipos:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const POST = withAuth(postHandler, ['ADMIN', 'IT']);
