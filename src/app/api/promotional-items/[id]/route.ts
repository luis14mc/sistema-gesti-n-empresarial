import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// ============================================
// GET /api/promotional-items/[id] — Detalle
// ============================================

async function getHandler(_req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;

        const item = await prisma.promotionalItem.findUnique({
            where: { id },
            include: {
                movements: { orderBy: { movementDate: 'desc' } },
            },
        });

        if (!item) {
            return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
        }

        return NextResponse.json({ item });
    } catch (error) {
        console.error('Error fetching promotional item:', error);
        return NextResponse.json({ error: 'Error al obtener item' }, { status: 500 });
    }
}

// ============================================
// PATCH /api/promotional-items/[id] — Actualizar
// ============================================

async function patchHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;
        const data = await req.json();

        const existing = await prisma.promotionalItem.findUnique({
            where: { id },
            select: { quantity: true, unitPrice: true, status: true, name: true },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
        }

        const item = await prisma.promotionalItem.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.quantity !== undefined && { quantity: data.quantity }),
                ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.purchaseDate !== undefined && data.purchaseDate && {
                    purchaseDate: new Date(data.purchaseDate),
                }),
                ...(data.inventoryCode !== undefined && { inventoryCode: data.inventoryCode }),
            },
        });

        await createAuditRecord({
            title: 'Actualización de item promocional',
            description: `Se actualizó item: ${item.name}`,
            module: 'INVENTARIO',
            category: 'UPDATE',
            userId: req.user!.userId,
            entityId: item.id,
            previousData: { quantity: existing.quantity, status: existing.status },
            newData: { quantity: item.quantity, status: item.status },
        });

        return NextResponse.json({ item });
    } catch (error) {
        console.error('Error updating promotional item:', error);
        return NextResponse.json({ error: 'Error al actualizar item' }, { status: 500 });
    }
}

// ============================================
// DELETE /api/promotional-items/[id] — Desactivar (soft)
// ============================================

async function deleteHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;

        const existing = await prisma.promotionalItem.findUnique({
            where: { id },
            select: { name: true, status: true },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
        }

        const item = await prisma.promotionalItem.update({
            where: { id },
            data: { status: 'INACTIVE' },
            select: { id: true, name: true, status: true },
        });

        await createAuditRecord({
            title: 'Desactivación de item promocional',
            description: `Se desactivó item: ${item.name}`,
            module: 'INVENTARIO',
            category: 'DELETE',
            userId: req.user!.userId,
            entityId: item.id,
            previousData: { status: existing.status },
            newData: { status: 'INACTIVE' },
        });

        return NextResponse.json({ item });
    } catch (error) {
        console.error('Error disabling promotional item:', error);
        return NextResponse.json({ error: 'Error al desactivar item' }, { status: 500 });
    }
}

export const GET    = withAuth(getHandler);
export const PATCH  = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
