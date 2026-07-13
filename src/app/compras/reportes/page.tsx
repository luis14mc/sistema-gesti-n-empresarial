'use client';

import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useComprasReportes } from '@/hooks/useCompras';
import { useAuth } from '@/hooks/useAuth';
import { COMPRA_ESTADO_LABELS, COMPRA_PRIORIDAD_LABELS } from '@/lib/compras/constants';

export default function ComprasReportesPage() {
  const { user } = useAuth();
  const { data: reportes, isLoading } = useComprasReportes(new Date().getFullYear());

  if (!user) return null;
  if (user.role !== 'ADMIN') {
    return (
      <MainLayout>
        <PageHeader title="Reportes de compras" description="Acceso restringido" />
        <p className="text-muted-foreground">Solo administradores pueden ver reportes de compras.</p>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader title="Reportes de compras" description={`Año ${reportes?.year ?? new Date().getFullYear()}`} />

      {isLoading || !reportes ? (
        <p>Cargando reportes...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Resumen operativo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Órdenes emitidas: <strong>{reportes.ordenesEmitidas}</strong></p>
              <p>Órdenes pendientes: <strong>{reportes.ordenesPendientes}</strong></p>
              <p>Compras cerradas: <strong>{reportes.cerradas}</strong></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Por estado</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {reportes.porEstado.map((row) => (
                <p key={row.estado}>
                  {COMPRA_ESTADO_LABELS[row.estado]}: {row._count._all} (L {(row._sum.total ?? 0).toFixed(2)})
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Por prioridad</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {reportes.porPrioridad.map((row) => (
                <p key={row.prioridad}>
                  {COMPRA_PRIORIDAD_LABELS[row.prioridad]}: {row._count._all}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Por departamento</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {reportes.porDepartamento.map((row) => (
                <p key={row.departamentoSolicitanteId}>
                  {row.departamento}: {row._count._all}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Por centro de costo</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {reportes.porCentroCosto.map((row) => (
                <p key={row.centroCostoId}>
                  {row.centroCosto}: {row._count._all}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Monto por mes</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {reportes.montoPorMes.map((row) => (
                <p key={row.mes}>
                  Mes {row.mes}: L {row.total.toFixed(2)} ({row.cantidad} solicitudes)
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </MainLayout>
  );
}
