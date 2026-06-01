import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// POST - Agregar comentario al ticket (stored in Json comments field)
async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: 'El contenido es requerido' },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket no encontrado' },
        { status: 404 }
      );
    }

    const existingComments = (ticket.comments as any[]) || [];
    const newComment = {
      id: crypto.randomUUID(),
      content,
      userId: req.user!.userId,
      createdAt: new Date().toISOString(),
    };

    const updatedTicket = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        comments: [...existingComments, newComment],
      },
    });

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (error) {
    console.error('Error al crear comentario:', error);
    return NextResponse.json(
      { error: 'Error al crear comentario' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
