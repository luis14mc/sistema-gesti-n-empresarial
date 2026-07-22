import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { createAuditRecord } from '@/lib/audit';
import type { OficioStatus, Role } from '@/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED: OficioStatus[] = ['DRAFT', 'SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED', 'ARCHIVED'];

async function patchHandler(req: AuthenticatedRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const role = req.user!.role as Role;
    if (!canAccess(role, 'oficios', 'update')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const next = body?.status as OficioStatus | undefined;
    if (!next || !ALLOWED.includes(next)) {
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
    }

    const current = await prisma.oficio.findUnique({
      where: { id },
      select: { id: true, status: true, number: true, createdById: true },
    });
    if (!current) {
      return NextResponse.json({ error: 'Oficio no encontrado' }, { status: 404 });
    }

    if (role === 'USER' && current.createdById !== req.user!.userId) {
      return NextResponse.json({ error: 'Oficio no encontrado' }, { status: 404 });
    }

    const data: Prisma.OficioUpdateInput = { status: next };
    if (next === 'SENT') data.sentDate = new Date();
    if (next === 'RECEIVED') data.receivedDate = new Date();

    const updated = await prisma.oficio.update({
      where: { id },
      data,
      include: {
        tracking: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { performedBy: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    await prisma.oficioTracking.create({
      data: {
        oficioId: id,
        action: 'STATUS_CHANGED',
        title: `Estado: ${current.status} → ${next}`,
        previousData: { status: current.status },
        newData: { status: next },
        performedById: req.user!.userId,
      },
    });

    await createAuditRecord({
      title: 'Cambio de estado de oficio',
      description: `Oficio ${current.number}: ${current.status} → ${next}`,
      module: 'OFICIOS',
      category: 'UPDATE',
      userId: req.user!.userId,
      entityId: id,
      previousData: { status: current.status },
      newData: { status: next },
    });

    return NextResponse.json({ oficio: updated });
  } catch (error) {
    console.error('Error en PATCH /api/oficios/[id]/status:', error);
    return NextResponse.json({ error: 'Error al cambiar estado' }, { status: 500 });
  }
}

export const PATCH = withAuth(patchHandler);
