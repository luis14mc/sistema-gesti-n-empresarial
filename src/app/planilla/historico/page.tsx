'use client';

import { useMemo, useState } from 'react';
import { Download, Eye, Search } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { PayrollChrome, planillaBreadcrumbs, PAYROLL_BRAND } from '@/components/payroll/payroll-chrome';
import { PayrollStatGrid } from '@/components/payroll/payroll-stat-grid';
import { PayrollMoneyCell, PayrollTable, type PayrollTableColumn } from '@/components/payroll/payroll-table';
import { MoneyLabel } from '@/components/payroll/money-label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { usePayrollPayslips } from '@/hooks/usePayroll';
import { payrollService, type PayslipListItem } from '@/services/payroll.service';

const DELIVERY_LABELS: Record<string, string> = {
  PDF: 'PDF',
  EMAIL: 'Correo',
  PDF_EMAIL: 'PDF + correo',
};

function deliveryLabel(type: string | undefined) {
  if (!type) return 'PDF';
  return DELIVERY_LABELS[type] ?? type;
}

export default function PlanillaHistoricoPage() {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<PayslipListItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const { payslips, summary, total, totalPages, isLoading } = usePayrollPayslips({
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 20,
  });

  const stats = useMemo(
    () => ({
      total: summary?.recordCount ?? total,
      netoSum: summary?.netPayTotal ?? 0,
      deductions: summary?.deductionsTotal ?? 0,
    }),
    [summary, total],
  );

  const columns: PayrollTableColumn<PayslipListItem>[] = [
    {
      id: 'employee',
      header: 'Empleado',
      cell: (p) => (
        <div>
          <p className="font-medium">{p.employee?.fullName ?? '—'}</p>
          {p.employee?.employeeCode ? (
            <p className="text-xs text-muted-foreground">{p.employee.employeeCode}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'period',
      header: 'Periodo',
      cell: (p) => `${p.month}/${p.year}`,
    },
    {
      id: 'delivery',
      header: 'Entrega',
      cell: (p) => (
        <Badge variant="outline" className="font-normal">
          {deliveryLabel(p.deliveryType)}
        </Badge>
      ),
    },
    {
      id: 'neto',
      header: 'Neto',
      align: 'right',
      money: true,
      cell: (p) => p.neto,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDetail(p)}>
            <Eye className="size-4" aria-hidden />
            <span className="sr-only">Detalle</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => window.open(payrollService.pdfUrl(p.id), '_blank')}
          >
            PDF
          </Button>
        </div>
      ),
    },
  ];

  async function exportAudit() {
    setError('');
    setExporting(true);
    try {
      const blob = await payrollService.exportPayslipsAudit({
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planilla-auditoria-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo exportar la auditoría. Verifique que el endpoint esté disponible.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Histórico de planilla"
          description="Recibos generados, entrega y exportación de auditoría."
          breadcrumbs={planillaBreadcrumbs('Histórico')}
          primaryAction={
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={exportAudit}
              style={{ borderColor: PAYROLL_BRAND, color: PAYROLL_BRAND }}
            >
              <Download className="mr-2 size-4" aria-hidden />
              {exporting ? 'Exportando…' : 'Exportar auditoría'}
            </Button>
          }
        />

        <PayrollChrome>
          <PayrollStatGrid
            items={[
              { label: 'Registros', value: stats.total },
              {
                label: 'Monto neto',
                value: <MoneyLabel amount={stats.netoSum} />,
              },
              {
                label: 'Deducciones',
                value: <MoneyLabel amount={stats.deductions} />,
              },
            ]}
          />

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Empleado…"
                    className="pl-9"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Desde</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Hasta</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Card className="border-border/60">
            <CardContent className="pt-6">
              <PayrollTable
                columns={columns}
                rows={payslips}
                rowKey={(p) => p.id}
                isLoading={isLoading}
              />
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages} · {total} registros
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </PayrollChrome>
      </div>

      <Dialog open={detail != null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del recibo</DialogTitle>
          </DialogHeader>
          {detail ? (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Empleado</dt>
                <dd className="text-right font-medium">{detail.employee?.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Periodo pago</dt>
                <dd>
                  {detail.month}/{detail.year}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rango</dt>
                <dd className="text-right text-xs">
                  {detail.periodStart} – {detail.periodEnd}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Entrega</dt>
                <dd>{deliveryLabel(detail.deliveryType)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Salario periodo</dt>
                <dd>
                  <PayrollMoneyCell amount={detail.salarioPeriodo} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">IHSS</dt>
                <dd>
                  <PayrollMoneyCell amount={detail.ihss} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">ISR</dt>
                <dd>
                  <PayrollMoneyCell amount={detail.isr} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Otras ded.</dt>
                <dd>
                  <PayrollMoneyCell amount={detail.otro} />
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                <dt>Neto</dt>
                <dd>
                  <PayrollMoneyCell amount={detail.neto} />
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
