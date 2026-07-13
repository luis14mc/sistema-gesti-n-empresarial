import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';

async function getHandler() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        positions: {
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error('Error al obtener departamentos:', error);
    return NextResponse.json({ error: 'Error al obtener departamentos' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
