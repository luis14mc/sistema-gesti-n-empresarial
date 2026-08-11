import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { correctiveActionWhere, findCorrectiveAction } from '@/modules/audits/infrastructure/repository';

// ============================================
// GET /api/corrective-actions/[id]
// ============================================

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const organization = await requireOrganizationContext(req);
        const { id } = await ctx.params;

        const action = await prisma.correctiveAction.findFirst({
            where: correctiveActionWhere(organization.organizationId, { id }),
            include: {
                responsible: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });

        if (!action) {
            return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
        }

        if (req.user!.role === 'USER' && action.responsibleId !== req.user!.userId) {
            return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
        }

        return NextResponse.json({ action });
    } catch (error) {
        console.error('Error fetching corrective action:', error);
        return NextResponse.json({ error: 'Error al obtener acción' }, { status: 500 });
    }
}

// ============================================
// PATCH /api/corrective-actions/[id]
// ============================================

async function patchHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const organization = await requireOrganizationContext(req);
        const { id } = await ctx.params;
        const data = await req.json();

        const existing = await findCorrectiveAction(organization.organizationId, id);
        if (!existing) {
            return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
        }

        // USER solo puede actualizar evidencia/notas en sus propias acciones
        if (req.user!.role === 'USER' && existing.responsibleId !== req.user!.userId) {
            return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
        }

        await prisma.correctiveAction.updateMany({
            where: correctiveActionWhere(organization.organizationId, { id }),
            data: {
                ...(data.description !== undefined && { description: data.description }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.responsibleId !== undefined && { responsibleId: data.responsibleId }),
                ...(data.dueDate !== undefined && {
                    dueDate: data.dueDate ? new Date(data.dueDate) : null,
                }),
                ...(data.completedDate !== undefined && {
                    completedDate: data.completedDate ? new Date(data.completedDate) : null,
                }),
                ...(data.evidence !== undefined && { evidence: data.evidence }),
                ...(data.notes !== undefined && { notes: data.notes }),
            },
        });
        const action = await prisma.correctiveAction.findFirstOrThrow({
            where: correctiveActionWhere(organization.organizationId, { id }),
            include: {
                responsible: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        await createAuditRecord({
            title: 'Actualización de acción correctiva',
            description: `Se actualizó acción: ${action.description.slice(0, 80)}`,
            module: 'AUDITORIA',
            category: 'UPDATE',
            userId: req.user!.userId,
            entityId: action.id,
            organizationId: organization.organizationId,
            previousData: { status: existing.status },
            newData: { status: action.status },
        });

        return NextResponse.json({ action });
    } catch (error) {
        console.error('Error updating corrective action:', error);
        return NextResponse.json({ error: 'Error al actualizar acción' }, { status: 500 });
    }
}

// ============================================
// DELETE /api/corrective-actions/[id]  (ADMIN)
// ============================================

async function deleteHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const organization = await requireOrganizationContext(req);
        const { id } = await ctx.params;

        const existing = await prisma.correctiveAction.findFirst({
            where: correctiveActionWhere(organization.organizationId, { id }),
            select: { description: true, status: true },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
        }

        await prisma.correctiveAction.deleteMany({ where: correctiveActionWhere(organization.organizationId, { id }) });

        await createAuditRecord({
            title: 'Eliminación de acción correctiva',
            description: `Se eliminó acción: ${existing.description.slice(0, 80)}`,
            module: 'AUDITORIA',
            category: 'DELETE',
            userId: req.user!.userId,
            entityId: id,
            organizationId: organization.organizationId,
            previousData: { status: existing.status },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting corrective action:', error);
        return NextResponse.json({ error: 'Error al eliminar acción' }, { status: 500 });
    }
}

export const GET    = withAuth(getHandler);
export const PATCH  = withAuth(patchHandler, ['ADMIN', 'RRHH', 'IT']);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);
