import { NextResponse } from 'next/server';
import type { PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import { requireOrganizationContext } from '@/modules/organizations/application/context';
import type { Role } from '@/types';

// ─────────────────────────────────────────────────────────────
// Phase 13 · C-1 remediation
// Purchasing reports MUST read the canonical purchase-order aggregate
// (`CompraOrden` → table `purchase_orders`), i.e. the same records the
// operational UI creates. Previously this route read the legacy
// `CompraSolicitud` (`compras_solicitudes`) table, which the active UI
// no longer writes to, so institutional figures did not reflect real
// orders. See docs/remediation/procurement-canonicalization.md.
// ─────────────────────────────────────────────────────────────

/**
 * Canonical `PurchaseOrderStatus` → legacy Spanish estado code.
 * We map back to the legacy vocabulary only so the existing report UI
 * (which labels rows via COMPRA_ESTADO_LABELS) keeps rendering unchanged.
 * The DATA source is fully canonical.
 */
const STATUS_TO_ESTADO: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'BORRADOR',
  GENERATED: 'GENERADA',
  ISSUED: 'EMITIDA',
  CANCELLED: 'ANULADA',
  CLOSED: 'CERRADA',
};

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req);

    if (!canAccess(role, 'purchases', 'read')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Reportes solo para roles autorizados' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const year = Number.parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const where = {
      organizationId,
      deletedAt: null,
      requestDate: { gte: start, lt: end },
    } as const;

    const [grouped, montoPorMes, ordenesEmitidas, enProceso, cerradas, anuladas] = await Promise.all([
      prisma.compraOrden.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.$queryRaw<Array<{ mes: number; total: number; cantidad: bigint }>>`
        SELECT EXTRACT(MONTH FROM "requestDate")::int AS mes,
               COALESCE(SUM("total"), 0)::float AS total,
               COUNT(*)::bigint AS cantidad
        FROM "purchase_orders"
        WHERE "deletedAt" IS NULL
          AND "organizationId" = ${organizationId}
          AND "requestDate" >= ${start}
          AND "requestDate" < ${end}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.compraOrden.count({ where: { ...where, status: 'ISSUED' } }),
      prisma.compraOrden.count({ where: { ...where, status: { in: ['DRAFT', 'GENERATED'] } } }),
      prisma.compraOrden.count({ where: { ...where, status: 'CLOSED' } }),
      prisma.compraOrden.count({ where: { ...where, status: 'CANCELLED' } }),
    ]);

    // Preserve the existing report contract: estado code + numeric total.
    const porEstado = grouped.map((row) => ({
      estado: STATUS_TO_ESTADO[row.status],
      _count: { _all: row._count._all },
      _sum: { total: row._sum.total ? Number(row._sum.total) : 0 },
    }));

    return NextResponse.json({
      year,
      porEstado,
      montoPorMes: montoPorMes.map((row) => ({
        mes: row.mes,
        total: Number(row.total),
        cantidad: Number(row.cantidad),
      })),
      ordenesEmitidas,
      enProceso,
      cerradas,
      anuladas,
    });
  } catch (error) {
    console.error('Error generating compras reportes:', error);
    return NextResponse.json({ error: 'Error al generar reportes' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
