import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { addFinding } from '@/modules/audits/application/audits-service';

// POST /api/audits/[id]/findings - Agregar hallazgo
async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const organization = await requireOrganizationContext(req);
    const { description, severity, evidence, clause } = await req.json();

    if (!description || !severity) {
      return NextResponse.json(
        { error: 'Descripción y severidad son requeridas' },
        { status: 400 }
      );
    }

    const finding = await addFinding(
      { organizationId: organization.organizationId, userId: req.user!.userId },
      params.id,
      { description, severity, evidence, clause },
    );
    if (!finding) {
      return NextResponse.json(
        { error: 'Auditoría no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ finding }, { status: 201 });
  } catch (error) {
    console.error('Error al crear hallazgo:', error);
    return NextResponse.json(
      { error: 'Error al crear hallazgo' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['ADMIN', 'RRHH', 'IT']);
