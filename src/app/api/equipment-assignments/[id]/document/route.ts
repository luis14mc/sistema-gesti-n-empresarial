import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { logEquipmentHistory } from '@/lib/equipment-history';
import { mapAssignmentResponse } from '@/lib/equipment-mapper';

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { documentType, documentUrl } = await req.json();

    if (!documentType || !documentUrl) {
      return NextResponse.json({ error: 'Tipo y URL del documento son requeridos' }, { status: 400 });
    }

    const assignment = await prisma.equipmentAssignment.findUnique({
      where: { id },
      include: { equipment: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 });
    }

    const updateData =
      documentType === 'return'
        ? { returnDocumentUrl: documentUrl }
        : { deliveryDocumentUrl: documentUrl, urlNotaPdf: documentUrl };

    const updated = await prisma.equipmentAssignment.update({
      where: { id },
      data: updateData,
      include: {
        equipment: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        employee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    await logEquipmentHistory({
      equipmentId: assignment.equipmentId,
      action: 'UPDATED',
      title: documentType === 'return' ? 'Formato de devolución adjunto' : 'Formato de asignación adjunto',
      description: `Documento firmado registrado para asignación ${id.slice(-8).toUpperCase()}.`,
      newData: { documentType, documentUrl },
      performedById: req.user!.userId,
    });

    return NextResponse.json({ assignment: mapAssignmentResponse(updated) });
  } catch (error) {
    console.error('Error al adjuntar documento:', error);
    return NextResponse.json({ error: 'Error al adjuntar documento' }, { status: 500 });
  }
}

export const PATCH = withAuth(patchHandler, ['ADMIN', 'IT']);
