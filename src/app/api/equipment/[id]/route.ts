import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// GET - Obtener equipo por ID
async function getHandler(
    req: AuthenticatedRequest,
    { params }: { params: { id: string } }
) {
    try {
        const equipment = await prisma.equipment.findUnique({
            where: { id: params.id },
            include: {
                assignments: {
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, email: true },
                        },
                    },
                    orderBy: { assignedDate: 'desc' },
                },
                maintenances: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!equipment) {
            return NextResponse.json(
                { error: 'Equipo no encontrado' },
                { status: 404 }
            );
        }

        // Mapear campos legacy `name` y `code` para compatibilidad con frontend
        const equipmentWithLegacy = {
            ...equipment,
            name: `${equipment.brand} ${equipment.model}`,
            code: equipment.inventoryCode,
        };

        return NextResponse.json({ equipment: equipmentWithLegacy });
    } catch (error) {
        console.error('Error al obtener equipo:', error);
        return NextResponse.json(
            { error: 'Error al obtener equipo' },
            { status: 500 }
        );
    }
}

// PATCH - Actualizar equipo
async function patchHandler(
    req: AuthenticatedRequest,
    { params }: { params: { id: string } }
) {
    try {
        const data = await req.json();
        const current = await prisma.equipment.findUnique({ where: { id: params.id } });

        if (!current) {
            return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
        }

        const allowedFields = ['type', 'brand', 'model', 'serialNumber', 'status', 'ram', 'processor', 'storage', 'os', 'retirementReason'];
        const updateData: any = {};

        allowedFields.forEach(field => {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        });

        const equipment = await prisma.equipment.update({
            where: { id: params.id },
            data: updateData,
        });

        await createAuditRecord({
            title: 'Actualización de equipo',
            description: `Se actualizó equipo: ${equipment.inventoryCode}`,
            module: 'EQUIPOS',
            category: 'UPDATE',
            userId: req.user!.userId,
            entityId: equipment.id,
            previousData: { status: current.status },
            newData: { status: equipment.status },
        });

        return NextResponse.json({ equipment });
    } catch (error) {
        console.error('Error al actualizar equipo:', error);
        return NextResponse.json({ error: 'Error al actualizar equipo' }, { status: 500 });
    }
}

// DELETE - Eliminar equipo (marca como RETIRED)
async function deleteHandler(
    req: AuthenticatedRequest,
    { params }: { params: { id: string } }
) {
    try {
        const current = await prisma.equipment.findUnique({ where: { id: params.id } });
        if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

        await prisma.equipment.update({
            where: { id: params.id },
            data: { status: 'RETIRED' },
        });

        // Registrar en auditoría
        await createAuditRecord({
            title: 'Eliminación de equipo',
            description: 'Equipo marcado como retirado/eliminado',
            module: 'EQUIPOS',
            category: 'DELETE',
            userId: req.user!.userId,
            entityId: params.id,
            previousData: { info: 'Soft delete applied', previousStatus: current.status },
        });

        return NextResponse.json({ message: 'Equipo marcado como retirado/eliminado' });
    } catch (error) {
        console.error('Error al eliminar equipo:', error);
        return NextResponse.json({ error: 'Error al eliminar equipo' }, { status: 500 });
    }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler, ['ADMIN', 'IT']);
export const DELETE = withAuth(deleteHandler, ['ADMIN', 'IT']);
