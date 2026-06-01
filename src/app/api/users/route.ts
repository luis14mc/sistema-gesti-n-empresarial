import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// ============================================
// GET /api/users — Listar usuarios (ADMIN only)
// ============================================

async function getHandler(req: AuthenticatedRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const role = searchParams.get('role');
        const search = searchParams.get('search');
        const isActive = searchParams.get('isActive');

        const where: Record<string, unknown> = {};

        if (role) where.role = role;
        if (isActive !== null && isActive !== undefined && isActive !== '') {
            where.isActive = isActive === 'true';
        }
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { employeeNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                employeeNumber: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                departmentId: true,
                positionId: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        return NextResponse.json(
            { error: 'Error al obtener usuarios' },
            { status: 500 }
        );
    }
}

// ============================================
// PATCH /api/users — Actualizar usuario (ADMIN only)
// ============================================

async function patchHandler(req: AuthenticatedRequest) {
    try {
        const body = await req.json();
        const { id, ...data } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'ID de usuario requerido' },
                { status: 400 }
            );
        }

        // Prevent changing own role
        if (id === req.user!.userId && data.role) {
            return NextResponse.json(
                { error: 'No puedes cambiar tu propio rol' },
                { status: 403 }
            );
        }

        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(data.firstName && { firstName: data.firstName }),
                ...(data.lastName && { lastName: data.lastName }),
                ...(data.email && { email: data.email }),
                ...(data.phone !== undefined && { phone: data.phone }),
                ...(data.role && { role: data.role }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.departmentId !== undefined && { departmentId: data.departmentId }),
                ...(data.positionId !== undefined && { positionId: data.positionId }),
            },
            select: {
                id: true,
                employeeNumber: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                departmentId: true,
                positionId: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        return NextResponse.json(
            { error: 'Error al actualizar usuario' },
            { status: 500 }
        );
    }
}

// ============================================
// POST /api/users — Crear usuario (ADMIN only)
// ============================================

async function postHandler(req: AuthenticatedRequest) {
    try {
        const body = await req.json();
        const { firstName, lastName, email, password, role, employeeNumber, phone, departmentId, positionId } = body;

        if (!firstName || !lastName || !email || !password || !employeeNumber) {
            return NextResponse.json(
                { error: 'Nombre, apellido, email, contraseña y número de empleado son requeridos' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json(
                { error: 'El email ya está registrado' },
                { status: 409 }
            );
        }

        // Hash password
        const { hashPassword } = await import('@/lib/auth');
        const hashedPassword = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                employeeNumber,
                firstName,
                lastName,
                email,
                password: hashedPassword,
                phone,
                role: role || 'USER',
                departmentId,
                positionId,
            },
            select: {
                id: true,
                employeeNumber: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isActive: true,
                departmentId: true,
                positionId: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json({ user }, { status: 201 });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        return NextResponse.json(
            { error: 'Error al crear usuario' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(getHandler, ['ADMIN', 'RRHH']);
export const POST = withAuth(postHandler, ['ADMIN']);
export const PATCH = withAuth(patchHandler, ['ADMIN']);
