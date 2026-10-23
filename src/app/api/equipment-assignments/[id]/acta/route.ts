import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { equipmentApiFailure } from '@/modules/equipment/application/http';
import { regenerateAssignmentActa } from '@/modules/equipment/application/assignment-service';
import { previewAssignmentActaHtml } from '@/modules/equipment/application/acta-generation';

async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.update');
    const { id } = await params;
    const body = (await req.json()) as { type?: string };
    const type = body.type === 'return' ? 'return' : 'delivery';

    const result = await regenerateAssignmentActa({
      organizationId,
      assignmentId: id,
      actorUserId: req.user!.userId,
      type,
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 });
    }
    if (result.kind === 'validation') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ assignment: result.assignment });
  } catch (error) {
    return equipmentApiFailure(error, requestId, {
      code: 'ASSIGNMENT_ACTA_REGENERATE_FAILED',
      message: 'No se pudo regenerar el acta',
      stage: 'REGENERATE_ASSIGNMENT_ACTA',
    });
  }
}

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.read');
    const { id } = await params;
    const typeParam = new URL(req.url).searchParams.get('type');
    const type = typeParam === 'return' ? 'return' : 'delivery';

    const html = await previewAssignmentActaHtml({
      organizationId,
      assignmentId: id,
      actorUserId: req.user!.userId,
      type,
    });

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 });
    }
    return equipmentApiFailure(error, requestId, {
      code: 'ASSIGNMENT_ACTA_PREVIEW_FAILED',
      message: 'No se pudo generar la vista previa del acta',
      stage: 'PREVIEW_ASSIGNMENT_ACTA',
    });
  }
}

export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);
