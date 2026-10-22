import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { addChecklistItem, evaluateChecklistItem } from '@/modules/audits/application/audits-service';

// POST /api/audits/[id]/checklist - Agregar item al checklist
async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const { requirement, clause, sortOrder } = await req.json();

    if (!requirement) {
      return NextResponse.json(
        { error: 'El requerimiento es obligatorio' },
        { status: 400 }
      );
    }

    const item = await addChecklistItem(
      { organizationId: organization.organizationId, userId: req.user!.userId },
      params.id,
      { requirement, clause, sortOrder },
    );
    if (!item) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error al crear item de checklist:', error);
    return NextResponse.json(
      { error: 'Error al crear item de checklist' },
      { status: 500 }
    );
  }
}

// PATCH /api/audits/[id]/checklist - Actualizar resultado de item
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const { itemId, result, notes, evidence, completed } = await req.json();

    if (!itemId) {
      return NextResponse.json(
        { error: 'ID del item es requerido' },
        { status: 400 }
      );
    }

    const item = await evaluateChecklistItem(
      { organizationId: organization.organizationId, userId: req.user!.userId },
      params.id,
      { itemId, result, notes, evidence, completed },
    );

    if (!item) {
      return NextResponse.json(
        { error: 'Item de checklist no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error al actualizar item de checklist:', error);
    return NextResponse.json(
      { error: 'Error al actualizar item de checklist' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['ADMIN', 'RRHH', 'IT']);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'RRHH', 'IT']);
