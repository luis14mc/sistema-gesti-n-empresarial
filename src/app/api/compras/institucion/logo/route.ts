import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getInstitutionConfig, saveInstitutionLogo } from '@/lib/compras/institution';
import { saveInstitutionSettings } from '@/lib/compras/institution-store';
import type { Role } from '@/types';

async function postHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden editar' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const logoPath = await saveInstitutionLogo(file);
    const settings = await saveInstitutionSettings({ logoPath });
    const config = await getInstitutionConfig();

    return NextResponse.json({ settings, logoUrl: config.logoUrl });
  } catch (error) {
    console.error('Error subiendo logo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al subir logo' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
