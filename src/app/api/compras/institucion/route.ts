import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import {
  getInstitutionConfig,
  getInstitutionSettings,
  saveInstitutionSettings,
} from '@/modules/purchases/application/institution';
import { z } from 'zod';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { handlePurchaseOrderRouteError } from '@/modules/purchases/presentation/http';

const institutionSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().min(5).max(500),
  phone: z.string().min(3).max(80),
  website: z.string().min(3).max(200),
});

async function getHandler(req: AuthenticatedRequest) {
  try {
    await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.read');

    const [settings, config] = await Promise.all([
      getInstitutionSettings(),
      getInstitutionConfig(),
    ]);

    return NextResponse.json({
      settings,
      logoUrl: config.logoUrl,
    });
  } catch (error) {
    return handlePurchaseOrderRouteError(error, 'GET /api/compras/institucion');
  }
}

async function putHandler(req: AuthenticatedRequest) {
  try {
    const { role } = await authorizeOrganization(req, crypto.randomUUID(), 'purchase-orders.update');
    if (role !== 'ADMIN' && role !== 'OWNER') {
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
    return handlePurchaseOrderRouteError(error, 'PUT /api/compras/institucion');
  }
}

export const GET = withAuth(getHandler);
export const PUT = withAuth(putHandler);
