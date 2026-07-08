import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// POST - Registrar movimiento de item promocional
async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { type, quantityOut, quantityReturn, movementDate, returnDate, eventName, eventLocation, eventDate, responsible, comments } = await req.json();

    if (!type || !quantityOut || !movementDate) {
      return NextResponse.json(
        { error: 'Tipo, cantidad de salida y fecha de movimiento son requeridos' },
        { status: 400 }
      );
    }

    const validTypes = ['EXIT', 'RETURN'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de movimiento inválido. Debe ser EXIT o RETURN' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Registrar el movimiento
      const movement = await tx.promotionalMovement.create({
        data: {
          itemId: params.id,
          type,
          quantityOut,
          quantityReturn: quantityReturn || 0,
          movementDate: new Date(movementDate),
          returnDate: returnDate ? new Date(returnDate) : undefined,
          eventName,
          eventLocation,
          eventDate: eventDate ? new Date(eventDate) : undefined,
          responsible,
          comments,
        },
      });

      let updatedItem;

      // Actualizar inventario de forma atómica
      if (type === 'EXIT') {
        // Asegura que solo actualiza si hay suficiente stock
        const updateResult = await tx.promotionalItem.updateMany({
          where: { id: params.id, quantity: { gte: quantityOut } },
          data: { quantity: { decrement: quantityOut } },
        });

        if (updateResult.count === 0) {
          throw new Error('STOCK_ERROR');
        }
        
        updatedItem = await tx.promotionalItem.findUnique({ where: { id: params.id } });
      } else {
        updatedItem = await tx.promotionalItem.update({
          where: { id: params.id },
          data: { quantity: { increment: quantityReturn || quantityOut } },
        });
      }

      return { movement, item: updatedItem };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear movimiento:', error);
    
    if (error.message === 'STOCK_ERROR') {
      return NextResponse.json(
        { error: 'No hay suficiente stock disponible o el item no existe' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al crear movimiento' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['ADMIN']);
