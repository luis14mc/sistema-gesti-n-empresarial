import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { getInstitutionConfig } from '@/lib/compras/institution';
import { getInstitutionSettings, saveInstitutionSettings } from '@/lib/compras/institution-store';
import { z } from 'zod';
import type { Role } from '@/types';

const institutionSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().min(5).max(500),
  phone: z.string().min(3).max(80),
  website: z.string().min(3).max(200),
});

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const [settings, config] = await Promise.all([
      getInstitutionSettings(),
      getInstitutionConfig(),
    ]);

    return NextResponse.json({
      settings,
      logoUrl: config.logoUrl,
    });
  } catch (error) {
    console.error('Error leyendo institución:', error);
    return NextResponse.json({ error: 'Error al leer configuración' }, { status: 500 });
  }
}

async function putHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden editar' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = institutionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const settings = await saveInstitutionSettings(parsed.data);
    const config = await getInstitutionConfig();

    return NextResponse.json({ settings, logoUrl: config.logoUrl });
  } catch (error) {
    console.error('Error guardando institución:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al guardar' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
