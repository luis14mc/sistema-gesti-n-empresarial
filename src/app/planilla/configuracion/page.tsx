'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePayrollSettings } from '@/hooks/usePayroll';
import { PAYROLL_YEAR } from '@/modules/payroll/domain';
import { payrollService } from '@/services/payroll.service';

export default function PlanillaConfiguracionPage() {
  const { settings, isLoading, updateSettings, isUpdating } = usePayrollSettings();
  const [form, setForm] = useState({
    medicalExpensesAnnual: '',
    ivmDeductibleMonthly: '',
    ihssEmRate: '',
    ihssIvmRate: '',
    ihssCeilingMonthly: '',
  });
  const [bracketsJson, setBracketsJson] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setForm({
      medicalExpensesAnnual: String(settings.medicalExpensesAnnual),
      ivmDeductibleMonthly: String(settings.ivmDeductibleMonthly),
      ihssEmRate: String(settings.ihssEmRate),
      ihssIvmRate: String(settings.ihssIvmRate),
      ihssCeilingMonthly: String(settings.ihssCeilingMonthly),
    });
  }, [settings]);

  useEffect(() => {
    payrollService.getIsrBrackets(PAYROLL_YEAR).then((res) => {
      const payload = res.data as { data: { brackets: unknown[] } };
      setBracketsJson(JSON.stringify(payload.data.brackets, null, 2));
    }).catch(() => setError('No se pudo cargar la tabla ISR.'));
  }, []);

  async function saveSettings() {
    setError('');
    setMessage('');
    try {
      await updateSettings({
        medicalExpensesAnnual: Number(form.medicalExpensesAnnual),
        ivmDeductibleMonthly: Number(form.ivmDeductibleMonthly),
        ihssEmRate: Number(form.ihssEmRate),
        ihssIvmRate: Number(form.ihssIvmRate),
        ihssCeilingMonthly: Number(form.ihssCeilingMonthly),
      });
      setMessage('Parámetros guardados.');
    } catch {
      setError('No se pudieron guardar los parámetros.');
    }
  }

  async function saveBrackets() {
    setError('');
    setMessage('');
    try {
      const brackets = JSON.parse(bracketsJson) as Array<{ order: number; rate: number; toAnnual: number }>;
      await payrollService.putIsrBrackets({ year: PAYROLL_YEAR, brackets });
      setMessage('Tabla ISR actualizada.');
    } catch {
      setError('JSON de tramos ISR inválido o error al guardar.');
    }
  }

  return (
    <MainLayout>
      <PageHeader
        title="Configuración de planilla"
        description="Parámetros IHSS, deducciones ISR y tabla de tramos."
        breadcrumbs={[
          { label: 'Personas', href: '/employees' },
          { label: 'Planilla', href: '/planilla' },
          { label: 'Configuración' },
        ]}
        secondaryActions={<Button variant="outline" asChild><Link href="/planilla">Generación</Link></Button>}
      />
      <div className="space-y-4 p-4 md:p-6">
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Card>
          <CardHeader><CardTitle>Parámetros generales</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
            {(
              [
                ['medicalExpensesAnnual', 'Gastos médicos anuales'],
                ['ivmDeductibleMonthly', 'IVM deducible mensual'],
                ['ihssEmRate', 'IHSS tasa EM (%)'],
                ['ihssIvmRate', 'IHSS tasa IVM (%)'],
                ['ihssCeilingMonthly', 'IHSS techo mensual'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-sm text-muted-foreground">{label}</label>
                <Input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="md:col-span-2">
              <Button type="button" disabled={isUpdating} onClick={saveSettings}>Guardar parámetros</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tabla ISR {PAYROLL_YEAR}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="min-h-[200px] w-full rounded-md border bg-background p-3 font-mono text-xs"
              value={bracketsJson}
              onChange={(e) => setBracketsJson(e.target.value)}
              aria-label="Tramos ISR en JSON"
            />
            <Button type="button" variant="secondary" onClick={saveBrackets}>Guardar tramos</Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
