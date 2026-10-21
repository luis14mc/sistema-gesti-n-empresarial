import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { createAudit, listAuditsPage } from '@/modules/audits/application/audits-service';

// GET /api/audits - Listar auditorías
async function getHandler(req: AuthenticatedRequest) {
  try {
    const organization = await requireOrganizationContext(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;

    const [audits, total] = await listAuditsPage(organization.organizationId, { status, type, search }, skip, pageSize);

    return NextResponse.json({
      audits,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error al obtener auditorías:', error);
    return NextResponse.json(
      { error: 'Error al obtener auditorías' },
      { status: 500 }
    );
  }
}

// POST /api/audits - Crear auditoría
async function postHandler(req: AuthenticatedRequest) {
  try {
    const organization = await requireOrganizationContext(req);
    const input = await req.json();

    if (!input.title) {
      return NextResponse.json(
        { error: 'El título es requerido' },
        { status: 400 }
      );
    }

    const audit = await createAudit({ organizationId: organization.organizationId, userId: req.user!.userId }, input);

    return NextResponse.json({ audit }, { status: 201 });
  } catch (error) {
    console.error('Error al crear auditoría:', error);
    return NextResponse.json(
      { error: 'Error al crear auditoría' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'RRHH', 'IT']);
