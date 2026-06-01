import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

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
    const allowedFields = ['subject', 'status', 'comments', 'attachments', 'oficioDate', 'receivedDate', 'sentDate'];
    
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
    await prisma.oficio.delete({
      where: { id: params.id },
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
