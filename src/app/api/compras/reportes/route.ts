import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';

async function getHandler(req: AuthenticatedRequest) {
  try {
    const role = req.user!.role as Role;
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
      deletedAt: null,
      fechaSolicitud: { gte: start, lt: end },
    };

    const [
      porEstado,
      porDepartamento,
      porCentroCosto,
      porPrioridad,
      montoPorMes,
      ordenesEmitidas,
      pendientesAprobacion,
      cerradas,
    ] = await Promise.all([
      prisma.compraSolicitud.groupBy({
        by: ['estado'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.compraSolicitud.groupBy({
        by: ['departamentoSolicitanteId'],
        where: { ...where, departamentoSolicitanteId: { not: null } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.compraSolicitud.groupBy({
        by: ['centroCostoId'],
        where: { ...where, centroCostoId: { not: null } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.compraSolicitud.groupBy({
        by: ['prioridad'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.$queryRaw<Array<{ mes: number; total: number; cantidad: bigint }>>`
        SELECT EXTRACT(MONTH FROM "fechaSolicitud")::int AS mes,
               COALESCE(SUM("total"), 0)::float AS total,
               COUNT(*)::bigint AS cantidad
        FROM "compras_solicitudes"
        WHERE "deletedAt" IS NULL
          AND "fechaSolicitud" >= ${start}
          AND "fechaSolicitud" < ${end}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.compraSolicitud.count({ where: { ...where, estado: 'ORDEN_EMITIDA' } }),
      prisma.compraSolicitud.count({
        where: { ...where, estado: { in: ['ENVIADA', 'AUTORIZADA'] } },
      }),
      prisma.compraSolicitud.count({ where: { ...where, estado: 'CERRADA' } }),
    ]);

    const [departamentos, centros] = await Promise.all([
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.costCenter.findMany({ select: { id: true, code: true, name: true } }),
    ]);

    const deptMap = Object.fromEntries(departamentos.map((d) => [d.id, d.name]));
    const centroMap = Object.fromEntries(centros.map((c) => [c.id, `${c.code} - ${c.name}`]));

    return NextResponse.json({
      year,
      porEstado,
      porDepartamento: porDepartamento.map((row) => ({
        ...row,
        departamento: row.departamentoSolicitanteId
          ? deptMap[row.departamentoSolicitanteId]
          : 'Sin departamento',
      })),
      porCentroCosto: porCentroCosto.map((row) => ({
        ...row,
        centroCosto: row.centroCostoId ? centroMap[row.centroCostoId] : 'Sin centro',
      })),
      porPrioridad,
      montoPorMes: montoPorMes.map((row) => ({
        mes: row.mes,
        total: Number(row.total),
        cantidad: Number(row.cantidad),
      })),
      ordenesEmitidas,
      pendientesAprobacion,
      cerradas,
    });
  } catch (error) {
    console.error('Error generating compras reportes:', error);
    return NextResponse.json({ error: 'Error al generar reportes' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
