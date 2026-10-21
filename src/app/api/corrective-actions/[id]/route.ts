import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import {
    getCorrectiveAction,
    removeCorrectiveAction,
    updateCorrectiveAction,
} from '@/modules/audits/application/corrective-actions-service';

// ============================================
// GET /api/corrective-actions/[id]
// ============================================

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const organization = await requireOrganizationContext(req);
        const { id } = await ctx.params;

        const result = await getCorrectiveAction({ organizationId: organization.organizationId, userId: req.user!.userId, role: req.user!.role }, id);

        if (result.kind === 'not-found') {
            return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
        }

        if (result.kind === 'forbidden') {
            return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
        }

        const { action } = result;
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

        const result = await updateCorrectiveAction({ organizationId: organization.organizationId, userId: req.user!.userId, role: req.user!.role }, id, data);
        if (result.kind === 'not-found') {
            return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
        }

        // USER solo puede actualizar evidencia/notas en sus propias acciones
        if (result.kind === 'forbidden') {
            return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
        }

        const { action } = result;
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

        const removed = await removeCorrectiveAction({ organizationId: organization.organizationId, userId: req.user!.userId, role: req.user!.role }, id);
        if (!removed) {
            return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting corrective action:', error);
        return NextResponse.json({ error: 'Error al eliminar acción' }, { status: 500 });
    }
}

export const GET    = withAuth(getHandler);
export const PATCH  = withAuth(patchHandler, ['ADMIN', 'RRHH', 'IT']);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);
