'use client';

import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useComprasReportes } from '@/hooks/useCompras';
import { useAuth } from '@/hooks/useAuth';
import { COMPRA_ESTADO_LABELS } from '@/lib/compras/constants';

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

  const exportYear = reportes?.year ?? new Date().getFullYear();

  return (
    <MainLayout>
      <PageHeader title="Reportes de compras" description={`Año ${exportYear}`} />

      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href={`/api/compras/reportes/export?format=csv&year=${exportYear}`}
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Exportar CSV
        </a>
        <a
          href={`/api/compras/reportes/export?format=xlsx&year=${exportYear}`}
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Exportar XLSX
        </a>
      </div>

      {isLoading || !reportes ? (
        <p>Cargando reportes...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Resumen operativo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Órdenes emitidas: <strong>{reportes.ordenesEmitidas}</strong></p>
              <p>En proceso: <strong>{reportes.enProceso}</strong></p>
              <p>Cerradas: <strong>{reportes.cerradas}</strong></p>
              <p>Anuladas: <strong>{reportes.anuladas}</strong></p>
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
            <CardHeader><CardTitle>Monto por mes</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {reportes.montoPorMes.map((row) => (
                <p key={row.mes}>
                  Mes {row.mes}: L {row.total.toFixed(2)} ({row.cantidad} órdenes)
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </MainLayout>
  );
}
