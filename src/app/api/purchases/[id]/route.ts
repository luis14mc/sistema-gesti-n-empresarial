import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// GET /api/purchases/:id — Obtener detalle
async function getHandler(
    req: AuthenticatedRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
        console.error('Error getting purchase:', error);
        return NextResponse.json({ error: 'Error al obtener solicitud' }, { status: 500 });
    }
}

// PATCH /api/purchases/:id — Actualizar
async function patchHandler(
    req: AuthenticatedRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const data = await req.json();

        const allowedFields = [
            'title', 'description', 'justification', 'category', 'priority', 'status',
            'deliveryDate', 'receptionDate', 'closingDate', 'attachments', 'comments',
        ];

        const updateData: Record<string, unknown> = {};
        allowedFields.forEach(field => {
            if (data[field] !== undefined) {
                if (['deliveryDate', 'receptionDate', 'closingDate'].includes(field) && data[field]) {
                    updateData[field] = new Date(data[field] as string);
                } else {
                    updateData[field] = data[field];
                }
            }
        });

        if (data.status === 'RECEIVED' && !updateData.receptionDate) {
            updateData.receptionDate = new Date();
        }
        if (data.status === 'CLOSED' && !updateData.closingDate) {
            updateData.closingDate = new Date();
        }

        const purchase = await prisma.purchaseRequest.update({
            where: { id },
            data: updateData,
            include: {
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        return NextResponse.json({ purchase });
    } catch (error) {
        console.error('Error updating purchase:', error);
        return NextResponse.json({ error: 'Error al actualizar solicitud' }, { status: 500 });
    }
}

// DELETE /api/purchases/:id — Eliminar
async function deleteHandler(
    req: AuthenticatedRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const role = req.user!.role;

        if (!['ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Sin permiso para eliminar' }, { status: 403 });
        }

        await prisma.purchaseRequest.delete({ where: { id } });
        return NextResponse.json({ message: 'Solicitud eliminada' });
    } catch (error) {
        console.error('Error deleting purchase:', error);
        return NextResponse.json({ error: 'Error al eliminar solicitud' }, { status: 500 });
    }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
