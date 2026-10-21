import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { updateProveedorSchema } from '@/modules/purchases/presentation/supplier-schemas';
import { deleteProveedor, updateProveedor } from '@/modules/purchases/application/suppliers';
import { validateRtn } from '@/modules/purchases/domain/rtn-validation';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { supplierFallbackError, supplierRouteErrorResponse } from '@/modules/purchases/presentation/http';

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
    const supplier = supplierRouteErrorResponse(error);
    if (supplier) return supplier;
    return supplierFallbackError('update', error);
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
    const supplier = supplierRouteErrorResponse(error);
    if (supplier) return supplier;
    return supplierFallbackError('delete', error);
  }
}

export const PATCH = withAuth(patchHandler);
export const DELETE = withAuth(deleteHandler);
