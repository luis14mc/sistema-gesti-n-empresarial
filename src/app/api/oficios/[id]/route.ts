import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// GET - Obtener oficio por ID
async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const oficio = await prisma.oficio.findUnique({
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!oficio) {
      return NextResponse.json(
        { error: 'Oficio no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ oficio });
  } catch (error) {
    console.error('Error al obtener oficio:', error);
    return NextResponse.json(
      { error: 'Error al obtener oficio' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar oficio
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();

    // Obtener estado anterior para auditoría
    const currentOficio = await prisma.oficio.findUnique({
      where: { id: params.id },
    });

    if (!currentOficio) {
      return NextResponse.json(
        { error: 'Oficio no encontrado' },
        { status: 404 }
      );
    }

    const allowedFields = ['subject', 'recipient', 'institution', 'preparedBy', 'status', 'attachments', 'oficioDate', 'receivedDate', 'sentDate'];

    const updateData: any = {};
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        if (['oficioDate', 'receivedDate', 'sentDate'].includes(field) && data[field]) {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    });

    if (data.status === 'SENT' && !updateData.sentDate) {
      updateData.sentDate = new Date();
    }

    const oficio = await prisma.oficio.update({
      where: { id: params.id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Registrar en auditoría
    await createAuditRecord({
      title: 'Actualización de oficio',
      description: `Se actualizó oficio: ${oficio.number} - ${oficio.subject}`,
      module: 'OFICIOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: oficio.id,
      previousData: { status: currentOficio.status, subject: currentOficio.subject },
      newData: { status: oficio.status, subject: oficio.subject },
    });

    return NextResponse.json({ oficio });
  } catch (error) {
    console.error('Error al actualizar oficio:', error);
    return NextResponse.json(
      { error: 'Error al actualizar oficio' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar oficio
async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const current = await prisma.oficio.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json(
        { error: 'Oficio no encontrado' },
        { status: 404 }
      );
    }

    await prisma.oficio.delete({
      where: { id: params.id },
    });

    // Registrar en auditoría
    await createAuditRecord({
      title: 'Eliminación de oficio',
      description: `Se eliminó oficio: ${current.number} - ${current.subject}`,
      module: 'OFICIOS',
      category: 'DELETE',
      userId: req.user!.userId,
      entityId: params.id,
      previousData: { number: current.number, subject: current.subject, status: current.status },
    });

    return NextResponse.json({ message: 'Oficio eliminado' });
  } catch (error) {
    console.error('Error al eliminar oficio:', error);
    return NextResponse.json(
      { error: 'Error al eliminar oficio' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);
