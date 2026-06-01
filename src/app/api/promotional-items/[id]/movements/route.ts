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

    const item = await prisma.promotionalItem.findUnique({
      where: { id: params.id },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Item no encontrado' },
        { status: 404 }
      );
    }

    let newQuantity = item.quantity;
    if (type === 'EXIT') {
      newQuantity -= quantityOut;
      if (newQuantity < 0) {
        return NextResponse.json(
          { error: 'No hay suficiente stock disponible' },
          { status: 400 }
        );
      }
    } else if (type === 'RETURN') {
      newQuantity += (quantityReturn || quantityOut);
    }

    const result = await prisma.$transaction([
      prisma.promotionalMovement.create({
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
      }),
      prisma.promotionalItem.update({
        where: { id: params.id },
        data: {
          quantity: newQuantity,
        },
      }),
    ]);

    return NextResponse.json({ 
      movement: result[0],
      item: result[1]
    }, { status: 201 });
  } catch (error) {
    console.error('Error al crear movimiento:', error);
    return NextResponse.json(
      { error: 'Error al crear movimiento' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler, ['ADMIN']);
