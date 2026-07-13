import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';

// ============================================
// GET /api/corrective-actions — Listar acciones correctivas
// ============================================

async function getHandler(req: AuthenticatedRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status       = searchParams.get('status');
        const auditId      = searchParams.get('auditId');
        const findingId    = searchParams.get('findingId');
        const responsibleId = searchParams.get('responsibleId');

        const page     = parseInt(searchParams.get('page') || '1');
        const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10'), 100);
        const skip     = (page - 1) * pageSize;

        const where: Record<string, unknown> = {};
        if (status)    where.status = status;
        if (auditId)   where.auditId = auditId;
        if (findingId) where.findingId = findingId;
        if (responsibleId) where.responsibleId = responsibleId;

        // IDOR: USER solo ve acciones donde es responsable
        if (req.user!.role === 'USER') {
            where.responsibleId = req.user!.userId;
        }

        const [actions, total] = await Promise.all([
            prisma.correctiveAction.findMany({
                where,
                skip,
                take: pageSize,
                include: {
                    responsible: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.correctiveAction.count({ where }),
        ]);

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
        const data = await req.json();
        const { description, auditId, findingId, responsibleId, dueDate, evidence, notes } = data;

        if (!description) {
            return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 });
        }

        // Validar auditId si viene
        if (auditId) {
            const audit = await prisma.audit.findUnique({ where: { id: auditId } });
            if (!audit) return NextResponse.json({ error: 'Auditoría no encontrada' }, { status: 404 });
        }

        const action = await prisma.correctiveAction.create({
            data: {
                description,
                auditId:        auditId ?? null,
                findingId:      findingId ?? null,
                responsibleId:  responsibleId ?? null,
                dueDate:        dueDate ? new Date(dueDate) : null,
                evidence:       evidence ?? null,
                notes:          notes ?? null,
            },
            include: {
                responsible: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        await createAuditRecord({
            title: 'Creación de acción correctiva',
            description: `Se creó acción: ${action.description.slice(0, 80)}`,
            module: 'AUDITORIA',
            category: 'CREATE',
            userId: req.user!.userId,
            entityId: action.id,
            newData: { auditId: action.auditId, status: action.status },
        });

        return NextResponse.json({ action }, { status: 201 });
    } catch (error) {
        console.error('Error creating corrective action:', error);
        return NextResponse.json({ error: 'Error al crear acción' }, { status: 500 });
    }
}

export const GET  = withAuth(getHandler);
export const POST = withAuth(postHandler, ['ADMIN', 'RRHH', 'IT']);
