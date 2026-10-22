export {
  handlePurchaseOrderRouteError,
  handlePrismaRouteError,
} from '@/modules/purchases/infrastructure/purchase-order-prisma-route-error';

export { mapLegacyEstadoFilter } from '@/modules/purchases/domain/legacy-status-map';

import { NextResponse } from 'next/server';
import { DomainError, PermissionDeniedError } from '@/platform/domain/errors';
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
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: error.httpStatus });
  }
  if (isPrismaUniqueViolation(error)) {
    return NextResponse.json(
      { error: 'Ya existe un proveedor con ese RTN en la organización' },
      { status: 409 },
    );
  }
  return null;
}

export type SupplierFallbackContext = 'list' | 'create' | 'update' | 'delete';

const SUPPLIER_FALLBACK_LOG: Record<SupplierFallbackContext, string> = {
  list: 'Error listing proveedores:',
  create: 'Error creating proveedor:',
  update: 'Error updating proveedor:',
  delete: 'Error deleting proveedor:',
};

const SUPPLIER_FALLBACK_MESSAGE: Record<SupplierFallbackContext, string> = {
  list: 'Error al listar proveedores',
  create: 'Error al crear proveedor',
  update: 'Error al actualizar proveedor',
  delete: 'Error al eliminar proveedor',
};

/** Generic 500 for proveedores routes — matches pre–phase-4b main (no Prisma/message leak). */
export function supplierFallbackError(context: SupplierFallbackContext, error: unknown): NextResponse {
  console.error(SUPPLIER_FALLBACK_LOG[context], error);
  return NextResponse.json({ error: SUPPLIER_FALLBACK_MESSAGE[context] }, { status: 500 });
}
