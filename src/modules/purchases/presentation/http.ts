export {
  handlePurchaseOrderRouteError,
  handlePrismaRouteError,
} from '@/modules/purchases/infrastructure/purchase-order-prisma-route-error';

export { mapLegacyEstadoFilter } from '@/modules/purchases/domain/legacy-status-map';

import { NextResponse } from 'next/server';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { isOrganizationContextError } from '@/modules/organizations/application/context';

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

export function supplierRouteErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (isOrganizationContextError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message === 'PROVEEDOR_NOT_FOUND') {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  }
  if (error instanceof Error && error.message === 'PROVEEDOR_HAS_DEPENDENCIES') {
    return NextResponse.json(
      { error: 'No se puede eliminar: el proveedor tiene órdenes o solicitudes asociadas' },
      { status: 409 },
    );
  }
  if (isPrismaUniqueViolation(error)) {
    return NextResponse.json(
      { error: 'Ya existe un proveedor con ese RTN en la organización' },
      { status: 409 },
    );
  }
  return null;
}
