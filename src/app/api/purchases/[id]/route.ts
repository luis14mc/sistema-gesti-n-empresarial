import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// ============================================
// GET /api/purchases/[id] — Detalle de solicitud
// ============================================

async function getHandler(_req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;

        const purchase = await prisma.purchaseRequest.findUnique({
            where: { id },
            include: {
                requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });

        if (!purchase) {
            return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
        }

        return NextResponse.json({ purchase });
    } catch (error) {
        console.error('Error fetching purchase:', error);
        return NextResponse.json({ error: 'Error al obtener solicitud' }, { status: 500 });
    }
}

// ============================================
// PATCH /api/purchases/[id] — Actualizar solicitud
// ============================================

async function patchHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;
        const data = await req.json();

        const existing = await prisma.purchaseRequest.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
        }

        const purchase = await prisma.purchaseRequest.update({
            where: { id },
            data: {
                ...(data.title !== undefined && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.justification !== undefined && { justification: data.justification }),
                ...(data.category !== undefined && { category: data.category }),
                ...(data.priority !== undefined && { priority: data.priority }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.deliveryDate !== undefined && {
                    deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
                }),
                ...(data.receptionDate !== undefined && {
                    receptionDate: data.receptionDate ? new Date(data.receptionDate) : null,
                }),
                ...(data.closingDate !== undefined && {
                    closingDate: data.closingDate ? new Date(data.closingDate) : null,
                }),
                ...(data.attachments !== undefined && { attachments: data.attachments }),
                ...(data.comments !== undefined && { comments: data.comments }),
            },
            include: {
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        await createAuditRecord({
            title: 'Actualización de solicitud de compra',
            description: `Se actualizó solicitud: ${purchase.title}`,
            module: 'COMPRAS',
            category: 'UPDATE',
            userId: req.user!.userId,
            entityId: purchase.id,
            previousData: {
                status: existing.status,
                priority: existing.priority,
            },
            newData: {
                status: purchase.status,
                priority: purchase.priority,
            },
        });

        return NextResponse.json({ purchase });
    } catch (error) {
        console.error('Error updating purchase:', error);
        return NextResponse.json({ error: 'Error al actualizar solicitud' }, { status: 500 });
    }
}

// ============================================
// DELETE /api/purchases/[id] — Eliminar solicitud (soft status)
// ============================================

async function deleteHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;

        const existing = await prisma.purchaseRequest.findUnique({
            where: { id },
            select: { title: true, status: true },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
        }

        // Soft delete: marcar CANCELLED en lugar de borrar (preserva auditoría)
        const purchase = await prisma.purchaseRequest.update({
            where: { id },
            data: { status: 'CANCELLED' },
            select: { id: true, title: true, status: true },
        });

        await createAuditRecord({
            title: 'Cancelación de solicitud de compra',
            description: `Se canceló solicitud: ${purchase.title}`,
            module: 'COMPRAS',
            category: 'DELETE',
            userId: req.user!.userId,
            entityId: purchase.id,
            previousData: { status: existing.status },
            newData: { status: 'CANCELLED' },
        });

        return NextResponse.json({ purchase });
    } catch (error) {
        console.error('Error cancelling purchase:', error);
        return NextResponse.json({ error: 'Error al cancelar solicitud' }, { status: 500 });
    }
}

export const GET    = withAuth(getHandler);
export const PATCH  = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
