import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { updateProveedorSchema } from '@/lib/compras/schemas';
import { updateProveedor, deleteProveedor } from '@/lib/compras/service';
import { validateRtn } from '@/lib/compras/validation';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { isOrganizationContextError } from '@/modules/organizations/application/context';

function authzFailure(error: unknown) {
  if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (isOrganizationContextError(error)) return NextResponse.json({ error: error.message }, { status: error.status });
  return null;
}

async function patchHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const requestId = crypto.randomUUID();
    const { organizationId } = await authorizeOrganization(req, requestId, 'suppliers.update');

    const { id } = await params;
    const body = await req.json();
    const parsed = updateProveedorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 },
      );
    }

    if (parsed.data.rtn && !validateRtn(parsed.data.rtn)) {
      return NextResponse.json({ error: 'RTN inválido (14 dígitos)' }, { status: 400 });
    }

    const proveedor = await updateProveedor(id, parsed.data, organizationId);
    return NextResponse.json({ proveedor });
  } catch (error) {
    const denied = authzFailure(error);
    if (denied) return denied;
    if (error instanceof Error && error.message === 'PROVEEDOR_NOT_FOUND') {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe un proveedor con ese RTN en la organización' },
        { status: 409 },
      );
    }
    console.error('Error updating proveedor:', error);
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 });
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const requestId = crypto.randomUUID();
    const { organizationId } = await authorizeOrganization(req, requestId, 'suppliers.update');

    const { id } = await params;
    await deleteProveedor(id, organizationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authzFailure(error);
    if (denied) return denied;
    if (error instanceof Error && error.message === 'PROVEEDOR_NOT_FOUND') {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'PROVEEDOR_HAS_DEPENDENCIES') {
      return NextResponse.json(
        { error: 'No se puede eliminar: el proveedor tiene órdenes o solicitudes asociadas' },
        { status: 409 },
      );
    }
    console.error('Error deleting proveedor:', error);
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 });
  }
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
