import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { getAuditDetail, removeAudit, updateAudit } from '@/modules/audits/application/audits-service';

// GET /api/audits/[id] - Obtener auditoría por ID
async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const audit = await getAuditDetail(organization.organizationId, params.id);

    if (!audit) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ audit });
  } catch (error) {
    console.error('Error al obtener auditoría:', error);
    return NextResponse.json(
      { error: 'Error al obtener auditoría' },
      { status: 500 }
    );
  }
}

// PATCH /api/audits/[id] - Actualizar auditoría
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const data = await req.json();
    const audit = await updateAudit({ organizationId: organization.organizationId, userId: req.user!.userId }, params.id, data);

    if (!audit) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ audit });
  } catch (error) {
    console.error('Error al actualizar auditoría:', error);
    return NextResponse.json(
      { error: 'Error al actualizar auditoría' },
      { status: 500 }
    );
  }
}

// DELETE /api/audits/[id] - Eliminar auditoría
async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const removed = await removeAudit({ organizationId: organization.organizationId, userId: req.user!.userId }, params.id);
    if (!removed) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Auditoría eliminada' });
  } catch (error) {
    console.error('Error al eliminar auditoría:', error);
    return NextResponse.json(
      { error: 'Error al eliminar auditoría' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'RRHH', 'IT']);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);
