import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

// GET - Obtener oficio por ID
async function getHandler(
  req: AuthenticatedRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  try {
    const oficio = await prisma.oficio.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        importedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        documents: {
          orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'desc' }],
          include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        tracking: {
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: { select: { id: true, firstName: true, lastName: true } },
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

    // IDOR: USER solo puede ver oficios donde es creador o destinatario por email
    if (req.user!.role === 'USER') {
      const isCreator = oficio.createdById === req.user!.userId;
      const isRecipient =
        !!oficio.recipient &&
        oficio.recipient.toLowerCase().includes(req.user!.email.toLowerCase());
      if (!isCreator && !isRecipient) {
        return NextResponse.json(
          { error: 'Oficio no encontrado' },
          { status: 404 }
        );
      }
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
  context: RouteContext
) {
  const { id } = await context.params;
  try {
    const data = await req.json();

    // Obtener estado anterior para auditoría
    const currentOficio = await prisma.oficio.findUnique({
      where: { id },
    });

    if (!currentOficio) {
      return NextResponse.json(
        { error: 'Oficio no encontrado' },
        { status: 404 }
      );
    }

    // IDOR: USER solo edita oficios propios
    if (req.user!.role === 'USER' && currentOficio.createdById !== req.user!.userId) {
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
      where: { id },
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
  context: RouteContext
) {
  const { id } = await context.params;
  try {
    const current = await prisma.oficio.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json(
        { error: 'Oficio no encontrado' },
        { status: 404 }
      );
    }

    // IDOR: USER no elimina oficios ajenos (y de hecho no debería poder
    // eliminar nada; pero esta salvaguarda evita bypass por role confusion).
    if (req.user!.role === 'USER' && current.createdById !== req.user!.userId) {
      return NextResponse.json(
        { error: 'Oficio no encontrado' },
        { status: 404 }
      );
    }

    await prisma.oficio.delete({
      where: { id },
    });

    // Registrar en auditoría
    await createAuditRecord({
      title: 'Eliminación de oficio',
      description: `Se eliminó oficio: ${current.number} - ${current.subject}`,
      module: 'OFICIOS',
      category: 'DELETE',
      userId: req.user!.userId,
      entityId: id,
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
