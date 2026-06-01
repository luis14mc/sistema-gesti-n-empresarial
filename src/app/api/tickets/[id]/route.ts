import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// GET - Obtener ticket por ID
async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ticket = await prisma.ticket.findUnique({
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
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error al obtener ticket:', error);
    return NextResponse.json(
      { error: 'Error al obtener ticket' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar ticket
async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();
    const currentTicket = await prisma.ticket.findUnique({ where: { id: params.id } });

    if (!currentTicket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    const allowedFields = ['title', 'description', 'status', 'priority', 'assignedToId', 'comments', 'attachments'];
    const updateData: any = {};

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    const isIT = ['ADMIN', 'IT'].includes(req.user!.role);
    const isCreator = currentTicket.createdById === req.user!.userId;

    if (data.status === 'RESOLVED') {
      if (!isIT) {
        return NextResponse.json({ error: 'Solo el personal técnico puede resolver el ticket' }, { status: 403 });
      }
    }

    if (data.status === 'CLOSED') {
      if (!isCreator && req.user!.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Solo el creador del ticket puede confirmar el cierre' }, { status: 403 });
      }
      updateData.closedAt = new Date();
    }

    const ticket = await prisma.ticket.update({
      where: { id: params.id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await createAuditRecord({
      title: 'Actualización de ticket',
      description: `Se actualizó ticket: ${ticket.title}`,
      module: 'TICKETS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: ticket.id,
      previousData: { status: currentTicket.status },
      newData: { status: ticket.status },
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error al actualizar ticket:', error);
    return NextResponse.json({ error: 'Error al actualizar ticket' }, { status: 500 });
  }
}

// DELETE - Eliminar ticket
async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.ticket.delete({
      where: { id: params.id },
    });

    await createAuditRecord({
      title: 'Eliminación de ticket',
      description: 'Ticket eliminado',
      module: 'TICKETS',
      category: 'DELETE',
      userId: req.user!.userId,
      entityId: params.id,
      previousData: { info: 'Hard delete applied' },
    });

    return NextResponse.json({ message: 'Ticket eliminado' });
  } catch (error) {
    console.error('Error al eliminar ticket:', error);
    return NextResponse.json(
      { error: 'Error al eliminar ticket' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);
