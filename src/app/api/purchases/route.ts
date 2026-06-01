import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// GET /api/purchases — Listar solicitudes
async function getHandler(req: AuthenticatedRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const category = searchParams.get('category');
        const priority = searchParams.get('priority');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '10');
        const skip = (page - 1) * pageSize;

        const where: any = {};
        if (status) where.status = status;
        if (category) where.category = category;
        if (priority) where.priority = priority;

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { justification: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [purchases, total] = await Promise.all([
            prisma.purchaseRequest.findMany({
                where,
                skip,
                take: pageSize,
                include: {
                    requestedBy: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.purchaseRequest.count({ where })
        ]);

        return NextResponse.json({
            purchases,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (error) {
        console.error('Error listing purchases:', error);
        return NextResponse.json({ error: 'Error al listar solicitudes' }, { status: 500 });
    }
}

// POST /api/purchases — Crear solicitud
async function postHandler(req: AuthenticatedRequest) {
    try {
        const data = await req.json();
        const { title, description, justification, category, priority, deliveryDate, attachments, comments } = data;

        if (!title || !description || !justification || !category) {
            return NextResponse.json({ error: 'Título, descripción, justificación y categoría son requeridos' }, { status: 400 });
        }

        const purchase = await prisma.purchaseRequest.create({
            data: {
                title,
                description,
                justification,
                category,
                priority: priority || 'MEDIUM',
                deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
                attachments: attachments || undefined,
                comments,
                requestedById: req.user!.userId,
            },
            include: {
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        return NextResponse.json({ purchase }, { status: 201 });
    } catch (error) {
        console.error('Error creating purchase:', error);
        return NextResponse.json({ error: 'Error al crear solicitud' }, { status: 500 });
    }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
