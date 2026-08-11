import { NextResponse } from 'next/server';
import type { PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import { createAuditRecord } from '@/lib/audit';
import {
  isSupportedExportFormat,
  renderExport,
  SUPPORTED_EXPORT_FORMATS,
} from '@/platform/reporting/export';
import {
  buildPurchaseOrderExportDataset,
  PurchaseExportTooLargeError,
} from '@/lib/compras/reportes/purchase-order-export';
import type { Role } from '@/types';

const VALID_STATUSES: readonly PurchaseOrderStatus[] = ['DRAFT', 'GENERATED', 'ISSUED', 'CANCELLED', 'CLOSED'];

/**
 * Phase 13 · Part 2 — real, bounded, synchronous export of the canonical
 * Purchase Order Summary report (reads CompraOrden, never CompraSolicitud).
 * CSV and XLSX only — the formats this system can actually produce. There is no
 * async job processor, so we never advertise async export (H-5 honesty).
 */
async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req, requestId);

    if (!canAccess(role, 'purchases', 'read') || role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos para exportar reportes' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get('format') || 'csv').toLowerCase();
    if (!isSupportedExportFormat(format)) {
      return NextResponse.json(
        { error: `Formato no soportado. Use: ${SUPPORTED_EXPORT_FORMATS.join(', ')}`, code: 'UNSUPPORTED_FORMAT' },
        { status: 400 },
      );
    }

    const year = Number.parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Año inválido' }, { status: 400 });
    }

    const statusParam = searchParams.get('status') as PurchaseOrderStatus | null;
    if (statusParam && !VALID_STATUSES.includes(statusParam)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const dataset = await buildPurchaseOrderExportDataset({
      prisma,
      organizationId,
      organizationName: organization?.name,
      year,
      status: statusParam ?? undefined,
    });

    const artifact = await renderExport(format, dataset);

    await createAuditRecord({
      title: 'Exportación de reporte de compras',
      description: `Exportó ${dataset.rows.length} órdenes (${format.toUpperCase()}, año ${year})`,
      module: 'COMPRAS',
      category: 'EXPORT',
      userId: req.user!.userId,
      organizationId,
      requestId,
      newData: { format, year, status: statusParam ?? null, rows: dataset.rows.length },
    });

    return new NextResponse(artifact.body as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': artifact.contentType,
        'Content-Disposition': `attachment; filename="${artifact.filename}"`,
        'Content-Length': String(artifact.body.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof PurchaseExportTooLargeError) {
      return NextResponse.json(
        { error: `El reporte excede el límite de ${error.limit} filas para exportación directa. Aplique filtros más específicos.`, code: 'EXPORT_ROW_LIMIT_EXCEEDED' },
        { status: 413 },
      );
    }
    console.error('Error exporting compras report:', error);
    return NextResponse.json({ error: 'Error al exportar el reporte' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
