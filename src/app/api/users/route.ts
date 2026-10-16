import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import {
  parseOrganizationRole,
  persistUserAccountRoles,
  presentAccountRole,
} from '@/platform/security/authorization/user-account-roles';
import { isOrganizationRoleAssignable } from '@/platform/security/authorization/role-catalog-service';
import {
  countActiveSuperAdminMemberships,
  isSuperAdminMembershipRole,
} from '@/modules/users/application/super-admin-membership';
import type { OrganizationRole } from '@prisma/client';
import { passwordPolicySchema } from '@/platform/security/password-policy';
import { z } from 'zod';

const createUserBodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: passwordPolicySchema,
  role: z.string(),
  employeeNumber: z.string().min(1),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  mustChangePassword: z.boolean().optional().default(true),
});

// ============================================
// GET /api/users — Listar usuarios miembros de la organización actual
// ============================================

async function getHandler(req: AuthenticatedRequest) {
    const requestId = crypto.randomUUID();
    try {
        const { organizationId } = await authorizeOrganization(req, requestId, 'users.read');
        const { searchParams } = new URL(req.url);
        const role = searchParams.get('role');
        const search = searchParams.get('search');
        const isActive = searchParams.get('isActive');

        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '100');
        const skip = (page - 1) * pageSize;

        const membershipFilter: Prisma.OrganizationMembershipListRelationFilter = {
            some: {
                organizationId,
                status: 'ACTIVE',
                ...(role ? { role: role as OrganizationRole } : {}),
            },
        };

        const where: Prisma.UserWhereInput = {
            organizationMemberships: membershipFilter,
        };
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
                    organizationMemberships: {
                        where: { organizationId, status: 'ACTIVE' },
                        select: { role: true },
                        take: 1,
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where })
        ]);

        return NextResponse.json({
            users: users.map(({ organizationMemberships, ...user }) => ({
                ...user,
                role: presentAccountRole(organizationMemberships[0]?.role, user.role),
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        if (error instanceof PermissionDeniedError) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (isOrganizationContextError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
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
        const context = await authorizeOrganization(req, requestId, 'users.update');
        const { organizationId } = context;
        const body = await req.json();
        const { id, confirmSelfRoleDemotion, ...data } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'ID de usuario requerido' },
                { status: 400 }
            );
        }

        const membership = await prisma.organizationMembership.findFirst({
            where: { userId: id, organizationId, status: 'ACTIVE' },
            select: {
                id: true,
                role: true,
                user: {
                    select: { role: true, isActive: true, firstName: true, lastName: true },
                },
            },
        });
        if (!membership) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }
        const previousUser = membership.user;

        let nextRoles: ReturnType<typeof persistUserAccountRoles> | null = null;
        if (data.role) {
            const parsedRole = parseOrganizationRole(data.role);
            if (!parsedRole) {
                return NextResponse.json({ error: 'Rol no válido' }, { status: 400 });
            }
            const roleUnchanged = parsedRole === membership.role;
            if (!roleUnchanged && !(await isOrganizationRoleAssignable(organizationId, parsedRole))) {
                return NextResponse.json(
                    { error: 'Este rol no está disponible para asignación' },
                    { status: 400 },
                );
            }
            if (!roleUnchanged) {
                await authorizeOrganization(req, requestId, 'memberships.manage');

                if (
                    isSuperAdminMembershipRole(membership.role) &&
                    !isSuperAdminMembershipRole(parsedRole)
                ) {
                    const remaining = await countActiveSuperAdminMemberships(organizationId, id);
                    if (remaining === 0) {
                        return NextResponse.json(
                            { error: 'Debe existir al menos un Super Admin activo' },
                            { status: 400 },
                        );
                    }
                }

                if (id === req.user!.userId && !confirmSelfRoleDemotion) {
                    return NextResponse.json(
                        {
                            error: 'CONFIRM_SELF_ROLE_CHANGE',
                            message:
                                'Perderá privilegios de administración si el nuevo rol no incluye Roles y permisos. Confirme para continuar.',
                        },
                        { status: 409 },
                    );
                }

                nextRoles = persistUserAccountRoles(parsedRole);
            }
        }

        if (
            data.isActive === false &&
            membership.user.isActive &&
            isSuperAdminMembershipRole(membership.role)
        ) {
            const remaining = await countActiveSuperAdminMemberships(organizationId, id);
            if (remaining === 0) {
                return NextResponse.json(
                    { error: 'Debe existir al menos un Super Admin activo' },
                    { status: 400 },
                );
            }
        }

        const user = await prisma.$transaction(async (tx) => {
            if (nextRoles) {
                await tx.organizationMembership.update({
                    where: { id: membership.id },
                    data: { role: nextRoles.membershipRole, accessVersion: { increment: 1 } },
                });
            }
            return tx.user.update({
                where: { id },
                data: {
                    ...(data.firstName && { firstName: data.firstName }),
                    ...(data.lastName && { lastName: data.lastName }),
                    ...(data.email && { email: data.email }),
                    ...(data.phone !== undefined && { phone: data.phone }),
                    ...(nextRoles ? { role: nextRoles.prismaUserRole } : {}),
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
        });

        const presentedRole = presentAccountRole(nextRoles?.membershipRole ?? membership.role, user.role);

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
            newData: { role: presentedRole, isActive: user.isActive },
        });

        return NextResponse.json({ user: { ...user, role: presentedRole } });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        if (error instanceof PermissionDeniedError) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (isOrganizationContextError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
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
        const { organizationId } = await authorizeOrganization(req, requestId, 'users.create');
        const parsedBody = createUserBodySchema.safeParse(await req.json());
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: parsedBody.error.issues[0]?.message ?? 'Datos inválidos' },
                { status: 400 },
            );
        }
        const {
            firstName,
            lastName,
            email,
            password,
            role,
            employeeNumber,
            phone,
            departmentId,
            positionId,
            mustChangePassword,
        } = parsedBody.data;

        const parsedRole = parseOrganizationRole(role);
        if (!parsedRole) {
            return NextResponse.json({ error: 'Seleccione un rol válido' }, { status: 400 });
        }
        if (!(await isOrganizationRoleAssignable(organizationId, parsedRole))) {
            return NextResponse.json(
                { error: 'Este rol no está disponible para asignación' },
                { status: 400 },
            );
        }
        await authorizeOrganization(req, requestId, 'memberships.manage');
        const accountRoles = persistUserAccountRoles(parsedRole);

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
                mustChangePassword,
                phone,
                role: accountRoles.prismaUserRole,
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
              role: accountRoles.membershipRole,
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
            newData: { email: user.email, role: accountRoles.membershipRole, employeeNumber: user.employeeNumber },
        });

        return NextResponse.json({ user: { ...user, role: accountRoles.membershipRole } }, { status: 201 });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        if (error instanceof PermissionDeniedError) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (isOrganizationContextError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json(
            { error: 'Error al crear usuario' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
export const PATCH = withAuth(patchHandler);
