import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { getInstitutionConfig, saveInstitutionLogo } from '@/lib/compras/institution';
import { saveInstitutionSettings } from '@/lib/compras/institution-store';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePrismaRouteError } from '@/lib/compras/orden/prisma-error';

async function postHandler(req: AuthenticatedRequest) {
  try {
    const { role } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.update');
    if (role !== 'ADMIN' && role !== 'OWNER') {
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
    return handlePrismaRouteError(error, 'POST /api/compras/institucion/logo');
  }
}

export const POST = withAuth(postHandler);
