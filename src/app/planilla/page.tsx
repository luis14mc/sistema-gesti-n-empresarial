'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoneyLabel } from '@/components/payroll/money-label';
import { usePayrollEmployees, usePayrollMutations } from '@/hooks/usePayroll';
import type { PayrollEmployeeListItem } from '@/services/payroll.service';

function defaultPayMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function PlanillaPage() {
  const [payMonth, setPayMonth] = useState(defaultPayMonth);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const { employees, isLoading } = usePayrollEmployees({ payrollEnabled: true, search: search || undefined });
  const { preview, generate, batchGenerate, previewData, isPreviewing, isGenerating, isBatching } = usePayrollMutations();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  );

  async function onPreview(employeeId: string) {
    setError('');
    setMessage('');
    setPreviewEmployeeId(employeeId);
    try {
      await preview({ employeeId, payMonth });
    } catch {
      setError('No se pudo calcular la vista previa.');
    }
  }

  async function onGenerateOne(employeeId: string) {
    setError('');
    try {
      await generate({ employeeId, payMonth });
      setMessage('Recibo generado correctamente.');
    } catch {
      setError('No se pudo generar el recibo.');
    }
  }

  async function onBatch() {
    if (selectedIds.length === 0) {
      setError('Seleccione al menos un empleado.');
      return;
    }
    setError('');
    try {
      const result = await batchGenerate({ payMonth, employeeIds: selectedIds });
      setMessage(`Lote completado: ${result.data.data.succeeded} exitosos, ${result.data.data.failed} con error.`);
    } catch {
      setError('No se pudo ejecutar la generación masiva.');
    }
  }

  return (
    <MainLayout>
      <PageHeader
        title="Planilla"
        description="Genere recibos de pago para el periodo CNI (cierre día 20)."
        breadcrumbs={[{ label: 'Personas', href: '/employees' }, { label: 'Planilla' }]}
        secondaryActions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link href="/planilla/historico">Histórico</Link></Button>
            <Button variant="outline" asChild><Link href="/planilla/empleados">Empleados</Link></Button>
            <Button variant="outline" asChild><Link href="/planilla/configuracion">Configuración</Link></Button>
          </div>
        )}
      />

      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Periodo de pago</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground" htmlFor="payMonth">Mes (YYYY-MM)</label>
              <Input id="payMonth" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} className="w-40" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-sm text-muted-foreground" htmlFor="search">Buscar</label>
              <Input id="search" placeholder="Nombre o código" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" disabled={isBatching} onClick={async () => {
              setError('');
              try {
                const result = await batchGenerate({ payMonth });
                setMessage(`Generación masiva: ${result.data.data.succeeded} exitosos, ${result.data.data.failed} con error.`);
              } catch {
                setError('No se pudo ejecutar la generación masiva.');
              }
            }}>
              {isBatching ? 'Generando…' : 'Generar todas'}
            </Button>
            <Button type="button" disabled={isBatching || selectedIds.length === 0} onClick={onBatch}>
              Generar seleccionados ({selectedIds.length})
            </Button>
          </CardContent>
        </Card>

        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle>Empleados en planilla</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2">Sel.</th>
                    <th className="py-2">Empleado</th>
                    <th className="py-2">Salario</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((row: PayrollEmployeeListItem) => {
                    const e = row;
                    return (
                      <tr key={e.id} className="border-b">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={!!selected[e.id]}
                            onChange={(ev) => setSelected((s) => ({ ...s, [e.id]: ev.target.checked }))}
                            aria-label={`Seleccionar ${e.fullName}`}
                          />
                        </td>
                        <td className="py-2">
                          <div className="font-medium">{e.fullName}</div>
                          {e.employeeCode ? <div className="text-xs text-muted-foreground">{e.employeeCode}</div> : null}
                        </td>
                        <td className="py-2">
                          {e.monthlySalary != null ? <MoneyLabel amount={e.monthlySalary} /> : '—'}
                        </td>
                        <td className="py-2 text-right space-x-2">
                          <Button size="sm" variant="outline" type="button" disabled={isPreviewing} onClick={() => onPreview(e.id)}>
                            Vista previa
                          </Button>
                          <Button size="sm" type="button" disabled={isGenerating} onClick={() => onGenerateOne(e.id)}>
                            Generar
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

        {previewData && previewEmployeeId ? (
          <Card>
            <CardHeader>
              <CardTitle>Vista previa</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-sm">
              <div>Salario periodo: <MoneyLabel amount={previewData.salarioPeriodo} /></div>
              <div>IHSS: <MoneyLabel amount={previewData.ihss} /></div>
              <div>ISR: <MoneyLabel amount={previewData.isr} /></div>
              <div>Otras deducciones: <MoneyLabel amount={previewData.otro} /></div>
              <div>Total deducciones: <MoneyLabel amount={previewData.totalDeducciones} /></div>
              <div className="font-semibold">Neto: <MoneyLabel amount={previewData.neto} /></div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MainLayout>
  );
}
