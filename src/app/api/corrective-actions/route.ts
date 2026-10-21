import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/platform/api/with-auth';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { createCorrectiveAction, listCorrectiveActionsPage } from '@/modules/audits/application/corrective-actions-service';

// ============================================
// GET /api/corrective-actions — Listar acciones correctivas
// ============================================

async function getHandler(req: AuthenticatedRequest) {
    try {
        const organization = await requireOrganizationContext(req);
        const { searchParams } = new URL(req.url);
        const status       = searchParams.get('status');
        const auditId      = searchParams.get('auditId');
        const findingId    = searchParams.get('findingId');
        const responsibleId = searchParams.get('responsibleId');

        const page     = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10'), 100);
        const skip     = (page - 1) * pageSize;

        const [actions, total] = await listCorrectiveActionsPage(
            { organizationId: organization.organizationId, userId: req.user!.userId, role: req.user!.role },
            { status, auditId, findingId, responsibleId },
            skip,
            pageSize,
        );

        return NextResponse.json({
            actions,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error('Error listing corrective actions:', error);
        return NextResponse.json({ error: 'Error al listar acciones' }, { status: 500 });
    }
}

// ============================================
// POST /api/corrective-actions — Crear acción correctiva
// ============================================

async function postHandler(req: AuthenticatedRequest) {
    try {
        const organization = await requireOrganizationContext(req);
        const data = await req.json();
        const { description } = data;

        if (!description) {
            return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 });
        }

        const result = await createCorrectiveAction(
            { organizationId: organization.organizationId, userId: req.user!.userId, role: req.user!.role },
            data,
        );
        if (result.kind === 'audit-not-found') return NextResponse.json({ error: 'Auditoría no encontrada' }, { status: 404 });
        if (result.kind === 'finding-not-found') {
            return NextResponse.json({ error: 'Hallazgo no encontrado' }, { status: 404 });
        }
        const { action } = result;

        return NextResponse.json({ action }, { status: 201 });
    } catch (error) {
        console.error('Error creating corrective action:', error);
        return NextResponse.json({ error: 'Error al crear acción' }, { status: 500 });
    }
}

export const GET  = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'RRHH', 'IT']);
