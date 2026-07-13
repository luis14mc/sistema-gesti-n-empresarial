import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// ============================================
// GET /api/time-entries/[id] — Detalle de marcación
// ============================================

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;

        const entry = await prisma.timeEntry.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });

        if (!entry) {
            return NextResponse.json({ error: 'Marcación no encontrada' }, { status: 404 });
        }

        // IDOR: USER solo ve sus propias marcaciones
        if (req.user!.role === 'USER' && entry.userId !== req.user!.userId) {
            return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
        }

        return NextResponse.json({ entry });
    } catch (error) {
        console.error('Error fetching time entry:', error);
        return NextResponse.json({ error: 'Error al obtener marcación' }, { status: 500 });
    }
}

// ============================================
// PATCH /api/time-entries/[id] — Corregir marcación (ADMIN)
// ============================================

async function patchHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;
        const data = await req.json();

        const existing = await prisma.timeEntry.findUnique({
            where: { id },
            select: { date: true, userId: true, checkIn: true, checkOut: true, status: true },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Marcación no encontrada' }, { status: 404 });
        }

        const entry = await prisma.timeEntry.update({
            where: { id },
            data: {
                ...(data.checkIn !== undefined && {
                    checkIn: data.checkIn ? new Date(data.checkIn) : null,
                }),
                ...(data.checkOut !== undefined && {
                    checkOut: data.checkOut ? new Date(data.checkOut) : null,
                }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(data.latitude !== undefined && { latitude: data.latitude }),
                ...(data.longitude !== undefined && { longitude: data.longitude }),
            },
            include: {
                user: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        return NextResponse.json({ entry });
    } catch (error) {
        console.error('Error updating time entry:', error);
        return NextResponse.json({ error: 'Error al actualizar marcación' }, { status: 500 });
    }
}

// ============================================
// DELETE /api/time-entries/[id] — Eliminar marcación (ADMIN)
// ============================================

async function deleteHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;

        const existing = await prisma.timeEntry.findUnique({
            where: { id },
            select: { userId: true, date: true },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Marcación no encontrada' }, { status: 404 });
        }

        await prisma.timeEntry.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting time entry:', error);
        return NextResponse.json({ error: 'Error al eliminar marcación' }, { status: 500 });
    }
}

export const GET    = withAuth(getHandler);
export const PATCH  = withAuth(patchHandler, ['ADMIN', 'RRHH']);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);
