import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createProveedorSchema } from '@/modules/purchases/presentation/supplier-schemas';
import { createProveedor, listSuppliers } from '@/modules/purchases/application/suppliers';
import { validateRtn } from '@/modules/purchases/domain/rtn-validation';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import { supplierFallbackError, supplierRouteErrorResponse } from '@/modules/purchases/presentation/http';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const requestId = crypto.randomUUID();
    const { organizationId } = await authorizeOrganization(req, requestId, 'suppliers.read');

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const activo = searchParams.get('activo');
    const page = Math.max(Number.parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10, 1), 50);

    const result = await listSuppliers({
      organizationId,
      search,
      activo: activo === 'true' ? true : undefined,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    const supplier = supplierRouteErrorResponse(error);
    if (supplier) return supplier;
    return supplierFallbackError('list', error);
  }
}

async function postHandler(req: AuthenticatedRequest) {
  try {
    const requestId = crypto.randomUUID();
    const { organizationId } = await authorizeOrganization(req, requestId, 'suppliers.create');

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
    const supplier = supplierRouteErrorResponse(error);
    if (supplier) return supplier;
    return supplierFallbackError('create', error);
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
