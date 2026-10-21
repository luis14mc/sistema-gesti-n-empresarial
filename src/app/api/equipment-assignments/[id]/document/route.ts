import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { attachAssignmentDocument } from '@/modules/equipment/application/assignment-service';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { authorizeOrganization } from '@/platform/security/authorization/http';

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.assign');
    const { id } = await params;
    const { documentType, documentUrl } = await req.json();
    const result = await attachAssignmentDocument({
      organizationId,
      assignmentId: id,
      performedById: req.user!.userId,
      documentType,
      documentUrl,
    });

    if (result.kind === 'validation') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.kind === 'invalid_url') {
      return NextResponse.json(
        { error: 'La URL del documento no pertenece al almacenamiento de la organización' },
        { status: 400 },
      );
    }
    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ assignment: result.assignment });
  } catch (error) {
    console.error('Error al adjuntar documento:', error);
    return equipmentApiFailure(error, requestId, { code: 'ASSIGNMENT_DOCUMENT_FAILED', message: 'Error al adjuntar documento', stage: 'UPDATE_ASSIGNMENT_DOCUMENT' });
  }
}

export const PATCH = withAuth(patchHandler);
