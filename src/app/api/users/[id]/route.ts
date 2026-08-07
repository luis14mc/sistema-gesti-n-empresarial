import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

// ============================================
// GET /api/users/[id] — Obtener usuario por id (ADMIN, RRHH)
// Solo retorna el usuario si es miembro activo de la organización actual.
// ============================================

async function getHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    const requestId = crypto.randomUUID();
    try {
        const { id } = await ctx.params;
        const { organizationId } = await requireOrganizationContext(req, requestId);

        const membership = await prisma.organizationMembership.findFirst({
            where: { userId: id, organizationId, status: 'ACTIVE' },
            select: {
                user: {
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
                        department: { select: { id: true, name: true } },
                        position:   { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!membership) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        return NextResponse.json({ user: membership.user });
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        return NextResponse.json({ error: 'Error al obtener usuario' }, { status: 500 });
    }
}

// ============================================
// PATCH /api/users/[id] — Actualizar usuario (ADMIN)
// Solo puede modificar usuarios miembros activos de la organización actual.
// ============================================

async function patchHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    const requestId = crypto.randomUUID();
    try {
        const { id } = await ctx.params;
        const { organizationId } = await requireOrganizationContext(req, requestId);
        const body = await req.json();

        const membership = await prisma.organizationMembership.findFirst({
            where: { userId: id, organizationId, status: 'ACTIVE' },
            select: {
                user: {
                    select: { role: true, isActive: true, firstName: true, lastName: true, email: true },
                },
            },
        });
        if (!membership) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }
        const existing = membership.user;

        if (id === req.user!.userId && body.role && body.role !== existing.role) {
            return NextResponse.json(
                { error: 'No puedes cambiar tu propio rol' },
                { status: 403 }
            );
        }

        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(body.firstName && { firstName: body.firstName }),
                ...(body.lastName && { lastName: body.lastName }),
                ...(body.email && { email: body.email }),
                ...(body.phone !== undefined && { phone: body.phone }),
                ...(body.role && { role: body.role }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
                ...(body.departmentId !== undefined && { departmentId: body.departmentId }),
                ...(body.positionId !== undefined && { positionId: body.positionId }),
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
            previousData: { role: existing.role, isActive: existing.isActive },
            newData: { role: user.role, isActive: user.isActive },
        });

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
    }
}

// ============================================
// DELETE /api/users/[id] — Soft delete (ADMIN)
// Solo puede desactivar usuarios miembros activos de la organización actual.
// ============================================

async function deleteHandler(req: AuthenticatedRequest, ctx: { params: Promise<{ id: string }> }) {
    const requestId = crypto.randomUUID();
    try {
        const { id } = await ctx.params;
        const { organizationId } = await requireOrganizationContext(req, requestId);

        if (id === req.user!.userId) {
            return NextResponse.json(
                { error: 'No puedes eliminar tu propia cuenta' },
                { status: 403 }
            );
        }

        const membership = await prisma.organizationMembership.findFirst({
            where: { userId: id, organizationId, status: 'ACTIVE' },
            select: {
                user: {
                    select: { firstName: true, lastName: true, email: true, isActive: true },
                },
            },
        });
        if (!membership) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }
        const existing = membership.user;

        const user = await prisma.user.update({
            where: { id },
            data: { isActive: false },
            select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
        });

        await createAuditRecord({
            title: 'Desactivación de usuario',
            description: `Se desactivó usuario: ${user.firstName} ${user.lastName} (${user.email})`,
            module: 'USUARIOS',
            category: 'DELETE',
            userId: req.user!.userId,
            entityId: user.id,
            organizationId,
            previousData: { isActive: existing.isActive },
            newData: { isActive: false },
        });

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
    }
}

export const GET    = withAuth(getHandler,    ['ADMIN', 'RRHH']);
export const PATCH  = withAuth(patchHandler,  ['ADMIN']);
export const DELETE = withAuth(deleteHandler, ['ADMIN']);
