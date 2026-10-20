'use client';

import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { PayrollChrome, planillaBreadcrumbs } from '@/components/payroll/payroll-chrome';
import { PayrollTable, type PayrollTableColumn } from '@/components/payroll/payroll-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePayrollIsrBrackets, usePayrollSettings, usePayrollSmtp } from '@/hooks/usePayroll';
import { PAYROLL_YEAR } from '@/modules/payroll/domain';
import type { IsrBracketRecord } from '@/services/payroll.service';

function formatRate(rate: number) {
  return `${rate.toLocaleString('es-HN', { maximumFractionDigits: 2 })}%`;
}

export default function PlanillaConfiguracionPage() {
  const { settings, isLoading, updateSettings, isUpdating } = usePayrollSettings();
  const {
    brackets,
    isLoading: bracketsLoading,
    saveBrackets,
    isSaving,
    resetTo2026Defaults,
    isResetting,
  } = usePayrollIsrBrackets(PAYROLL_YEAR);
  const { smtp, isLoading: smtpLoading, testConnection, isTesting } = usePayrollSmtp();

  const [isrForm, setIsrForm] = useState({ medicalExpensesAnnual: '', ivmDeductibleMonthly: '' });
  const [ihssForm, setIhssForm] = useState({
    ihssEmRate: '',
    ihssIvmRate: '',
    ihssCeilingMonthly: '',
  });
  const [bracketEdits, setBracketEdits] = useState<IsrBracketRecord[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setIsrForm({
      medicalExpensesAnnual: String(settings.medicalExpensesAnnual),
      ivmDeductibleMonthly: String(settings.ivmDeductibleMonthly),
    });
    setIhssForm({
      ihssEmRate: String(settings.ihssEmRate),
      ihssIvmRate: String(settings.ihssIvmRate),
      ihssCeilingMonthly: String(settings.ihssCeilingMonthly),
    });
  }, [settings]);

  useEffect(() => {
    setBracketEdits(brackets);
  }, [brackets]);

  async function saveIsrDeductions() {
    setError('');
    setMessage('');
    try {
      await updateSettings({
        medicalExpensesAnnual: Number(isrForm.medicalExpensesAnnual),
        ivmDeductibleMonthly: Number(isrForm.ivmDeductibleMonthly),
      });
      setMessage('Deducciones ISR guardadas.');
    } catch {
      setError('No se pudieron guardar las deducciones ISR.');
    }
  }

  async function saveIhss() {
    setError('');
    setMessage('');
    try {
      await updateSettings({
        ihssEmRate: Number(ihssForm.ihssEmRate),
        ihssIvmRate: Number(ihssForm.ihssIvmRate),
        ihssCeilingMonthly: Number(ihssForm.ihssCeilingMonthly),
      });
      setMessage('Parámetros IHSS guardados.');
    } catch {
      setError('No se pudieron guardar los parámetros IHSS.');
    }
  }

  async function saveBracketTable() {
    setError('');
    setMessage('');
    try {
      await saveBrackets(
        bracketEdits.map((b, index) => ({
          order: b.order ?? index + 1,
          rate: Number(b.rate),
          toAnnual: Number(b.toAnnual),
        })),
      );
      setMessage('Tabla ISR actualizada.');
    } catch {
      setError('No se pudo guardar la tabla ISR.');
    }
  }

  async function onTestSmtp() {
    setError('');
    setMessage('');
    try {
      const result = await testConnection();
      const sentTo = result.data.data?.sentTo;
      setMessage(sentTo ? `Correo de prueba enviado a ${sentTo}.` : 'Conexión SMTP verificada.');
    } catch {
      setError('No se pudo verificar SMTP. Revise las variables en Railway.');
    }
  }

  async function onReset2026() {
    setError('');
    setMessage('');
    try {
      await resetTo2026Defaults();
      setMessage('Tabla ISR restablecida a valores 2026.');
    } catch {
      setError('No se pudo restablecer la tabla ISR.');
    }
  }

  const bracketColumns: PayrollTableColumn<IsrBracketRecord>[] = [
    { id: 'order', header: 'Tramo', cell: (b) => b.order },
    {
      id: 'rate',
      header: 'Tasa',
      align: 'right',
      cell: (b) => formatRate(b.rate),
    },
    {
      id: 'to',
      header: 'Hasta (anual L)',
      align: 'right',
      cell: (b) =>
        b.toAnnual >= 999_999_999 ? '∞' : b.toAnnual.toLocaleString('es-HN', { minimumFractionDigits: 2 }),
    },
    {
      id: 'edit',
      header: 'Tope anual',
      align: 'right',
      cell: (b) => (
        <Input
          className="ml-auto h-8 w-36 text-right font-mono text-xs"
          value={String(b.toAnnual)}
          onChange={(e) => {
            const next = Number(e.target.value);
            setBracketEdits((rows) =>
              rows.map((row) => (row.order === b.order ? { ...row, toAnnual: next } : row)),
            );
          }}
        />
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Configuración de planilla"
          description="Parámetros fiscales IHSS, deducciones ISR y envío de boletas."
          breadcrumbs={planillaBreadcrumbs('Configuración')}
        />

        <PayrollChrome>
          {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Deducciones ISR</CardTitle>
                <CardDescription>Gastos médicos anuales e IVM deducible mensual (Art. 22).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
                <div className="space-y-2">
                  <Label htmlFor="medicalExpensesAnnual">Gastos médicos anuales (L)</Label>
                  <Input
                    id="medicalExpensesAnnual"
                    value={isrForm.medicalExpensesAnnual}
                    onChange={(e) => setIsrForm((f) => ({ ...f, medicalExpensesAnnual: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ivmDeductibleMonthly">IVM deducible mensual (L)</Label>
                  <Input
                    id="ivmDeductibleMonthly"
                    value={isrForm.ivmDeductibleMonthly}
                    onChange={(e) => setIsrForm((f) => ({ ...f, ivmDeductibleMonthly: e.target.value }))}
                  />
                </div>
                <Button type="button" disabled={isUpdating} onClick={saveIsrDeductions}>
                  {isUpdating ? 'Guardando…' : 'Guardar deducciones'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">IHSS empleado</CardTitle>
                <CardDescription>Tasas y techo mensual para retención.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ihssEmRate">Tasa EM (%)</Label>
                  <Input
                    id="ihssEmRate"
                    value={ihssForm.ihssEmRate}
                    onChange={(e) => setIhssForm((f) => ({ ...f, ihssEmRate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ihssIvmRate">Tasa IVM (%)</Label>
                  <Input
                    id="ihssIvmRate"
                    value={ihssForm.ihssIvmRate}
                    onChange={(e) => setIhssForm((f) => ({ ...f, ihssIvmRate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ihssCeilingMonthly">Techo mensual (L)</Label>
                  <Input
                    id="ihssCeilingMonthly"
                    value={ihssForm.ihssCeilingMonthly}
                    onChange={(e) => setIhssForm((f) => ({ ...f, ihssCeilingMonthly: e.target.value }))}
                  />
                </div>
                <Button type="button" disabled={isUpdating} onClick={saveIhss}>
                  {isUpdating ? 'Guardando…' : 'Guardar IHSS'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Tabla ISR {PAYROLL_YEAR}</CardTitle>
                <CardDescription>Tramos progresivos SAR — Honduras.</CardDescription>
              </div>
              <Button type="button" variant="outline" disabled={isResetting} onClick={onReset2026}>
                {isResetting ? 'Restableciendo…' : 'Restablecer 2026'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <PayrollTable
                columns={bracketColumns}
                rows={bracketEdits}
                rowKey={(b) => String(b.order)}
                isLoading={bracketsLoading}
              />
              <Button type="button" variant="secondary" disabled={isSaving} onClick={saveBracketTable}>
                {isSaving ? 'Guardando…' : 'Guardar tramos'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Correo (SMTP)</CardTitle>
                <CardDescription>
                  Valores detectados desde el entorno (Railway). La contraseña nunca se muestra ni se guarda en la
                  base de datos.
                </CardDescription>
              </div>
              <Button type="button" variant="secondary" disabled={isTesting || smtpLoading} onClick={onTestSmtp}>
                {isTesting ? 'Probando…' : 'Probar conexión'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {smtpLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Servidor SMTP</Label>
                  <Input readOnly value={smtp?.host ?? '—'} className="bg-muted/40 font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Puerto</Label>
                  <Input readOnly value={smtp ? String(smtp.port) : '—'} className="bg-muted/40 font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Input readOnly value={smtp?.user ?? '—'} className="bg-muted/40 font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Remitente</Label>
                  <Input readOnly value={smtp?.from ?? '—'} className="bg-muted/40 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña SMTP</Label>
                  <Input
                    readOnly
                    value={smtp?.passwordConfigured ? 'configurada ✔' : 'no configurada ✖'}
                    className="bg-muted/40 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    readOnly
                    value={smtp?.configured ? 'Listo para enviar ✔' : 'Incompleto ✖'}
                    className="bg-muted/40 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </PayrollChrome>
      </div>
    </MainLayout>
  );
}
