import type { PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const STATUS_TO_ESTADO: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'BORRADOR',
  GENERATED: 'GENERADA',
  ISSUED: 'EMITIDA',
  CANCELLED: 'ANULADA',
  CLOSED: 'CERRADA',
};

export async function getPurchaseReportsSummary(organizationId: string, year: number) {
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

  const porEstado = grouped.map((row) => ({
    estado: STATUS_TO_ESTADO[row.status],
    _count: { _all: row._count._all },
    _sum: { total: row._sum.total ? Number(row._sum.total) : 0 },
  }));

  return {
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
  };
}
