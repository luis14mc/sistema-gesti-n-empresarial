import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

async function getHandler(req: AuthenticatedRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const module = searchParams.get('module');
        const category = searchParams.get('action') || searchParams.get('category');
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '20');
        const skip = (page - 1) * pageSize;

        const where: any = {};
        if (userId) where.userId = userId;
        if (module) where.module = module;
        if (category) where.category = category;

        const [logs, total] = await Promise.all([
            prisma.auditRecord.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
            }),
            prisma.auditRecord.count({ where }),
        ]);

        return NextResponse.json({
            logs,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error('Error al obtener logs:', error);
        return NextResponse.json(
            { error: 'Error al obtener logs de auditoría' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(getHandler, ['ADMIN']);
