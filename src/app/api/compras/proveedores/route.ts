import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';
import { createProveedorSchema } from '@/lib/compras/schemas';
import { createProveedor } from '@/lib/compras/service';
import { validateRtn } from '@/lib/compras/validation';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);
    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const activo = searchParams.get('activo');
    const page = Math.max(Number.parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10, 1), 50);
    const skip = (page - 1) * pageSize;
    const where = {
      organizationId,
      deletedAt: null,
      ...(activo === 'true' ? { activo: true } : {}),
      ...(search
        ? {
            OR: [
              { nombreRazonSocial: { contains: search, mode: 'insensitive' as const } },
              { rtn: { contains: search.replace(/[^0-9]/g, ''), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [proveedores, total] = await Promise.all([
      prisma.proveedor.findMany({ where, skip, take: pageSize, orderBy: { nombreRazonSocial: 'asc' } }),
      prisma.proveedor.count({ where }),
    ]);

    return NextResponse.json({ proveedores, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    console.error('Error listing proveedores:', error);
    return NextResponse.json({ error: 'Error al listar proveedores' }, { status: 500 });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);
    if (!canAccess(role, 'purchases', 'create')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createProveedorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
    }

    if (!validateRtn(parsed.data.rtn)) {
      return NextResponse.json({ error: 'RTN inválido (14 dígitos)' }, { status: 400 });
    }

    const proveedor = await createProveedor(parsed.data, organizationId);
    return NextResponse.json({ proveedor }, { status: 201 });
  } catch (error) {
    console.error('Error creating proveedor:', error);
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
