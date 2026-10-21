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
  const {
    smtp,
    isLoading: smtpLoading,
    saveSettings: saveSmtpSettings,
    isSaving: isSavingSmtp,
    testConnection,
    isTesting,
  } = usePayrollSmtp();

  const [isrForm, setIsrForm] = useState({ medicalExpensesAnnual: '', ivmDeductibleMonthly: '' });
  const [ihssForm, setIhssForm] = useState({
    ihssEmRate: '',
    ihssIvmRate: '',
    ihssCeilingMonthly: '',
  });
  const [bracketEdits, setBracketEdits] = useState<IsrBracketRecord[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [smtpForm, setSmtpForm] = useState({
    host: 'smtp.office365.com',
    port: '587',
    username: '',
    password: '',
    senderName: 'Servicios Online',
    fromAddress: 'notificaciones@cni.hn',
    replyTo: '',
  });
  const [isrTestSalary, setIsrTestSalary] = useState('');
  const [isrTestResult, setIsrTestResult] = useState<string | null>(null);
  const [isrTesting, setIsrTesting] = useState(false);

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

  useEffect(() => {
    if (!smtp) return;
    setSmtpForm((f) => ({
      ...f,
      host: smtp.host,
      port: String(smtp.port),
      username: smtp.username,
      password: '',
      senderName: smtp.senderName,
      fromAddress: smtp.fromAddress,
      replyTo: smtp.replyTo ?? '',
    }));
  }, [smtp]);

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

  async function onSaveSmtp() {
    setError('');
    setMessage('');
    if (!smtp?.secretsKeyConfigured && smtpForm.password.trim()) {
      setError('Falta PAYROLL_SECRETS_KEY en Railway');
      return;
    }
    try {
      await saveSmtpSettings({
        host: smtpForm.host.trim(),
        port: Number(smtpForm.port),
        username: smtpForm.username.trim(),
        password: smtpForm.password,
        senderName: smtpForm.senderName.trim(),
        fromAddress: smtpForm.fromAddress.trim(),
        replyTo: smtpForm.replyTo.trim() ? smtpForm.replyTo.trim() : null,
      });
      setSmtpForm((f) => ({ ...f, password: '' }));
      setMessage('Configuración SMTP guardada.');
    } catch {
      setError('No se pudo guardar SMTP.');
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
      setError('No se pudo verificar SMTP. Guarde la configuración y revise credenciales.');
    }
  }

  async function onTestIsrCalc() {
    setError('');
    setIsrTestResult(null);
    setIsrTesting(true);
    try {
      const { payrollService } = await import('@/services/payroll.service');
      const res = await payrollService.previewIsrCalc({ monthlySalary: Number(isrTestSalary) || 0 });
      const d = res.data.data;
      if (!d) return;
      setIsrTestResult(`IHSS L. ${d.ihss.toFixed(2)} · ISR L. ${d.isr.toFixed(2)} · Neto L. ${d.neto.toFixed(2)}`);
    } catch {
      setError('No se pudo probar el cálculo ISR/IHSS.');
    } finally {
      setIsrTesting(false);
    }
  }

  async function onRecalcAllEmployees() {
    setError('');
    setMessage('');
    try {
      const { payrollService } = await import('@/services/payroll.service');
      const res = await payrollService.recalculateAllDeductions();
      setMessage(res.data.data?.message ?? 'Recálculo registrado.');
    } catch {
      setError('No se pudo ejecutar el recálculo.');
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
                <p className="text-xs text-muted-foreground">
                  ISR anual = (Salario × 12 − gastos médicos − IVM deducible × meses trabajados) × tabla progresiva.
                </p>
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
                <p className="text-xs text-muted-foreground">
                  IHSS = min(salario periodo, techo) × (EM% + IVM%) / 100.
                </p>
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
              <div className="flex flex-wrap gap-2">
                <div className="flex flex-1 flex-wrap items-end gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="isrTestSalary">Probar cálculo (salario mensual L)</Label>
                    <Input
                      id="isrTestSalary"
                      value={isrTestSalary}
                      onChange={(e) => setIsrTestSalary(e.target.value)}
                      className="w-40 font-mono"
                    />
                  </div>
                  <Button type="button" variant="outline" disabled={isrTesting} onClick={onTestIsrCalc}>
                    {isrTesting ? 'Calculando…' : 'Probar cálculo'}
                  </Button>
                </div>
                <Button type="button" variant="outline" onClick={onRecalcAllEmployees}>
                  Recalcular todos los empleados
                </Button>
              </div>
              {isrTestResult ? <p className="text-sm text-muted-foreground">{isrTestResult}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setBracketEdits((rows) => [
                      ...rows,
                      {
                        order: rows.length + 1,
                        rate: 0,
                        toAnnual: 999_999_999,
                      },
                    ])
                  }
                >
                  Agregar tramo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bracketEdits.length <= 1}
                  onClick={() => setBracketEdits((rows) => rows.slice(0, -1))}
                >
                  Eliminar último tramo
                </Button>
              </div>
              <Button type="button" variant="secondary" disabled={isSaving} onClick={saveBracketTable}>
                {isSaving ? 'Guardando…' : 'Guardar tabla ISR'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Configuración SMTP</CardTitle>
                <CardDescription>
                  Prioridad: base de datos; si no hay fila, variables SMTP_* del entorno. Puerto 465 = SSL; otros =
                  STARTTLS.
                </CardDescription>
              </div>
              <Button type="button" variant="secondary" disabled={isTesting || smtpLoading} onClick={onTestSmtp}>
                {isTesting ? 'Probando…' : 'Probar conexión'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {smtpLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
              {!smtp?.secretsKeyConfigured ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  Falta PAYROLL_SECRETS_KEY en Railway. No se puede cifrar una contraseña nueva hasta configurarla.
                </p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">Servidor SMTP</Label>
                  <Input
                    id="smtpHost"
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, host: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Puerto</Label>
                  <Input
                    id="smtpPort"
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, port: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">Usuario</Label>
                  <Input
                    id="smtpUser"
                    value={smtpForm.username}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, username: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">Contraseña</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder={smtp?.passwordConfigured ? '•••••••• (conservar si vacío)' : 'Requerida'}
                    value={smtpForm.password}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, password: e.target.value }))}
                    disabled={!smtp?.secretsKeyConfigured && !smtp?.passwordConfigured}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpSender">Nombre del emisor</Label>
                  <Input
                    id="smtpSender"
                    value={smtpForm.senderName}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, senderName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpFrom">Correo remitente</Label>
                  <Input
                    id="smtpFrom"
                    type="email"
                    value={smtpForm.fromAddress}
                    onChange={(e) => setSmtpForm((f) => ({ ...f, fromAddress: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                From: {smtpForm.senderName} &lt;{smtpForm.fromAddress}&gt; · Origen activo:{' '}
                {smtp?.source === 'database' ? 'base de datos' : 'entorno'} ·{' '}
                {smtp?.configured ? 'Listo para enviar ✔' : 'Incompleto ✖'}
              </p>
              <Button type="button" disabled={isSavingSmtp} onClick={onSaveSmtp}>
                {isSavingSmtp ? 'Guardando…' : 'Guardar SMTP'}
              </Button>
            </CardContent>
          </Card>
        </PayrollChrome>
      </div>
    </MainLayout>
  );
}
