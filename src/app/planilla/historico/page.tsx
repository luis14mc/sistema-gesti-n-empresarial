'use client';

import { useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoneyLabel } from '@/components/payroll/money-label';
import { usePayrollPayslips } from '@/hooks/usePayroll';
import { payrollService, type PayslipListItem } from '@/services/payroll.service';

export default function PlanillaHistoricoPage() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState('');
  const { payslips, isLoading } = usePayrollPayslips({
    year: year ? parseInt(year, 10) : undefined,
    month: month ? parseInt(month, 10) : undefined,
  });

  return (
    <MainLayout>
      <PageHeader
        title="Histórico de planilla"
        description="Recibos generados por mes."
        breadcrumbs={[
          { label: 'Personas', href: '/employees' },
          { label: 'Planilla', href: '/planilla' },
          { label: 'Histórico' },
        ]}
        secondaryActions={<Button variant="outline" asChild><Link href="/planilla">Volver a generación</Link></Button>}
      />
      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-wrap gap-4 pt-6">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground" htmlFor="year">Año</label>
              <Input id="year" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground" htmlFor="month">Mes (opcional)</label>
              <Input id="month" className="w-28" placeholder="1-12" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recibos</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Empleado</th>
                    <th className="py-2">Periodo</th>
                    <th className="py-2">Neto</th>
                    <th className="py-2 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((row: PayslipListItem) => {
                    const p = row;
                    return (
                      <tr key={p.id} className="border-b">
                        <td className="py-2">{p.employee?.fullName ?? '—'}</td>
                        <td className="py-2">{p.month}/{p.year}</td>
                        <td className="py-2"><MoneyLabel amount={p.neto} /></td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant="outline" type="button" onClick={() => window.open(payrollService.pdfUrl(p.id), '_blank')}>
                            Ver PDF
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
