import { NextResponse } from 'next/server';
import { Prisma, type Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

// ============================================
// GET /api/users — Listar usuarios miembros de la organización actual
// ============================================

async function getHandler(req: AuthenticatedRequest) {
    const requestId = crypto.randomUUID();
    try {
        const { organizationId } = await requireOrganizationContext(req, requestId);
        const { searchParams } = new URL(req.url);
        const role = searchParams.get('role');
        const search = searchParams.get('search');
        const isActive = searchParams.get('isActive');

        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '100');
        const skip = (page - 1) * pageSize;

        const where: Prisma.UserWhereInput = {
            organizationMemberships: {
                some: { organizationId, status: 'ACTIVE' },
            },
        };

        if (role) where.role = role as Role;
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

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: pageSize,
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
            }),
            prisma.user.count({ where })
        ]);

        return NextResponse.json({
            users,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
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
// Solo si el usuario target es miembro activo de la organización actual.
// ============================================

async function patchHandler(req: AuthenticatedRequest) {
    const requestId = crypto.randomUUID();
    try {
        const { organizationId } = await requireOrganizationContext(req, requestId);
        const body = await req.json();
        const { id, ...data } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'ID de usuario requerido' },
                { status: 400 }
            );
        }

        if (id === req.user!.userId && data.role) {
            return NextResponse.json(
                { error: 'No puedes cambiar tu propio rol' },
                { status: 403 }
            );
        }

        const membership = await prisma.organizationMembership.findFirst({
            where: { userId: id, organizationId, status: 'ACTIVE' },
            select: {
                user: {
                    select: { role: true, isActive: true, firstName: true, lastName: true },
                },
            },
        });
        if (!membership) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }
        const previousUser = membership.user;

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

        await createAuditRecord({
            title: 'Actualización de usuario',
            description: `Se actualizó usuario: ${user.firstName} ${user.lastName}`,
            module: 'USUARIOS',
            category: 'UPDATE',
            userId: req.user!.userId,
            entityId: user.id,
            organizationId,
            previousData: {
              role: previousUser.role,
              isActive: previousUser.isActive,
            },
            newData: { role: user.role, isActive: user.isActive },
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
// Crea el usuario y le asigna una membership activa en la organización actual.
// ============================================

async function postHandler(req: AuthenticatedRequest) {
    const requestId = crypto.randomUUID();
    try {
        const { organizationId } = await requireOrganizationContext(req, requestId);
        const body = await req.json();
        const { firstName, lastName, email, password, role, employeeNumber, phone, departmentId, positionId } = body;

        if (!firstName || !lastName || !email || !password || !employeeNumber) {
            return NextResponse.json(
                { error: 'Nombre, apellido, email, contraseña y número de empleado son requeridos' },
                { status: 400 }
            );
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json(
                { error: 'El email ya está registrado' },
                { status: 409 }
            );
        }

        const { hashPassword } = await import('@/lib/auth');
        const hashedPassword = await hashPassword(password);

        const user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
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
          await tx.organizationMembership.create({
            data: {
              organizationId,
              userId: created.id,
              role: 'USER',
              status: 'ACTIVE',
            },
          });
          return created;
        });

        await createAuditRecord({
            title: 'Creación de usuario',
            description: `Se creó usuario: ${user.firstName} ${user.lastName} (${user.email})`,
            module: 'USUARIOS',
            category: 'CREATE',
            userId: req.user!.userId,
            entityId: user.id,
            organizationId,
            newData: { email: user.email, role: user.role, employeeNumber: user.employeeNumber },
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
