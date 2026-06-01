import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { Prisma } from '@prisma/client';

// GET - Obtener registros de tiempo
async function getHandler(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let requestedUserId = searchParams.get('userId');
    
    // RBAC: Si el usuario es rol USER, forzamos a que solo vea sus propios registros.
    if (req.user!.role === 'USER') {
      requestedUserId = req.user!.userId;
    } else {
      // ADMIN, RRHH, IT pueden ver el de otros si lo especifican, sino ven los suyos por defecto.
      requestedUserId = requestedUserId || req.user!.userId;
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Prisma.TimeEntryWhereInput = { userId: requestedUserId || undefined };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ timeEntries });
  } catch (error) {
    console.error('Error al obtener registros:', error);
    return NextResponse.json(
      { error: 'Error al obtener registros' },
      { status: 500 }
    );
  }
}

// POST - Registrar entrada/salida
async function postHandler(req: AuthenticatedRequest) {
  try {
    const { checkIn, checkOut, notes, latitude, longitude, status } = await req.json();

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'La geolocalización es obligatoria para el marcaje' },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingEntry = await prisma.timeEntry.findUnique({
      where: {
        userId_date: {
          userId: req.user!.userId,
          date: today,
        },
      },
    });

    let timeEntry;

    if (existingEntry) {
      timeEntry = await prisma.timeEntry.update({
        where: { id: existingEntry.id },
        data: {
          ...(checkOut ? { checkOut: new Date(checkOut) } : {}),
          ...(notes ? { notes } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    } else {
      timeEntry = await prisma.timeEntry.create({
        data: {
          userId: req.user!.userId,
          date: today,
          checkIn: checkIn ? new Date(checkIn) : new Date(),
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          notes,
          status: status || 'ON_TIME',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    }

    await createAuditRecord({
      title: `Registro de asistencia`,
      description: existingEntry ? 'Actualización de marcaje' : 'Marcaje de entrada registrado',
      module: 'ASISTENCIA',
      category: existingEntry ? 'UPDATE' : 'CREATE',
      userId: req.user!.userId,
      entityId: timeEntry.id,
      newData: { coords: { latitude, longitude } },
    });

    return NextResponse.json({ timeEntry }, { status: existingEntry ? 200 : 201 });
  } catch (error) {
    console.error('Error al crear registro:', error);
    return NextResponse.json(
      { error: 'Error al crear registro' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
