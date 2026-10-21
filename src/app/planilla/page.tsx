'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, FileDown, Mail, Play, Users } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  PayrollChrome,
  formatPayrollPeriodLabel,
  planillaBreadcrumbs,
  PAYROLL_BRAND,
} from '@/components/payroll/payroll-chrome';
import { buildMinimalPayslipHtml } from '@/components/payroll/payroll-preview-html';
import { MoneyLabel } from '@/components/payroll/money-label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PlanillaMonthEmailPanel } from '@/components/payroll/planilla-month-email-panel';
import { usePayrollEmployees, usePayrollMutations } from '@/hooks/usePayroll';
import type { PayrollEmployeeListItem, PayslipBatchDeliveryMode } from '@/services/payroll.service';

function defaultPayMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function PlanillaPage() {
  const [payMonth, setPayMonth] = useState(defaultPayMonth);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollEmployeeListItem | null>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchMode, setBatchMode] = useState<PayslipBatchDeliveryMode>('pdf');
  const [batchConfirmed, setBatchConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { employees, isLoading } = usePayrollEmployees({
    payrollEnabled: true,
    search: employeeSearch || undefined,
    pageSize: 100,
  });
  const {
    preview,
    clearPreview,
    generate,
    batchGenerate,
    previewData,
    isPreviewing,
    isGenerating,
    isBatching,
    batchResult,
    sendPayslipEmails,
    isSendingEmails,
  } = usePayrollMutations();

  const periodLabel = useMemo(() => formatPayrollPeriodLabel(payMonth), [payMonth]);

  const previewHtml = useMemo(() => {
    if (!previewData || !selectedEmployee) return null;
    if (previewData.previewHtml) return previewData.previewHtml;
    return buildMinimalPayslipHtml(previewData, selectedEmployee, payMonth);
  }, [previewData, selectedEmployee, payMonth]);

  async function onPreview() {
    if (!selectedEmployee) {
      setError('Seleccione un empleado.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await preview({ employeeId: selectedEmployee.id, payMonth });
    } catch {
      setError('No se pudo calcular la vista previa.');
    }
  }

  async function onGeneratePdf() {
    if (!selectedEmployee) return;
    setError('');
    try {
      await generate({ employeeId: selectedEmployee.id, payMonth });
      setMessage('Recibo generado. Puede descargarlo desde Histórico.');
    } catch {
      setError('No se pudo generar el recibo.');
    }
  }

  function payMonthParts() {
    const [year, month] = payMonth.split('-').map(Number);
    return { year, month };
  }

  async function onConfirmBatch() {
    setError('');
    setMessage('');
    setBatchConfirmed(true);
    try {
      await batchGenerate({ payMonth, deliveryMode: batchMode });
      setMessage('Generación masiva finalizada.');
    } catch {
      setError('No se pudo ejecutar la generación masiva.');
    }
  }

  async function onSendEmailForSelected(force = true) {
    if (!selectedEmployee) return;
    setError('');
    try {
      await generate({ employeeId: selectedEmployee.id, payMonth });
      const { year, month } = payMonthParts();
      await sendPayslipEmails({
        year,
        month,
        employeeIds: [selectedEmployee.id],
        force,
      });
      setMessage('Boleta enviada por correo.');
    } catch {
      setError('No se pudo enviar el correo.');
    }
  }

  async function onPdfAndEmailForSelected() {
    if (!selectedEmployee) return;
    setError('');
    try {
      await generate({ employeeId: selectedEmployee.id, payMonth });
      const { year, month } = payMonthParts();
      await sendPayslipEmails({
        year,
        month,
        employeeIds: [selectedEmployee.id],
        force: true,
      });
      setMessage('PDF generado y correo enviado.');
    } catch {
      setError('No se pudo completar PDF + correo.');
    }
  }

  const employeeNameById = useMemo(() => new Map(employees.map((e) => [e.id, e.fullName])), [employees]);

  return (
    <MainLayout>
      <TooltipProvider>
        <div className="space-y-6 p-4 md:p-6">
          <PageHeader
            title="Planilla"
            description="Genere boletas de pago con periodo CNI (cierre día 20)."
            breadcrumbs={planillaBreadcrumbs('Boletas')}
            primaryAction={
              <Button
                type="button"
                disabled={isBatching}
                onClick={() => {
                  setBatchConfirmed(false);
                  setBatchDialogOpen(true);
                }}
                style={{ backgroundColor: PAYROLL_BRAND }}
                className="text-white hover:opacity-90"
              >
                <Users className="mr-2 size-4" aria-hidden />
                {isBatching ? 'Generando…' : 'Generar todos'}
              </Button>
            }
          />

          <PayrollChrome>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
              <Card className="border-border/60 lg:sticky lg:top-4 lg:self-start">
                <CardHeader>
                  <CardTitle className="text-base">Generación individual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Empleado</Label>
                    <Popover open={comboOpen} onOpenChange={setComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboOpen}
                          className="w-full justify-between font-normal"
                        >
                          {selectedEmployee ? selectedEmployee.fullName : 'Buscar empleado…'}
                          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Nombre o código…"
                            value={employeeSearch}
                            onValueChange={setEmployeeSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {isLoading ? 'Cargando…' : 'Sin empleados en planilla.'}
                            </CommandEmpty>
                            <CommandGroup>
                              {employees.map((e) => (
                                <CommandItem
                                  key={e.id}
                                  value={e.id}
                                  onSelect={() => {
                                    setSelectedEmployee(e);
                                    setComboOpen(false);
                                    clearPreview();
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 size-4',
                                      selectedEmployee?.id === e.id ? 'opacity-100' : 'opacity-0',
                                    )}
                                  />
                                  <span className="truncate">{e.fullName}</span>
                                  {e.employeeCode ? (
                                    <span className="ml-auto text-xs text-muted-foreground">{e.employeeCode}</span>
                                  ) : null}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payMonth">Mes de pago (YYYY-MM)</Label>
                    <Input
                      id="payMonth"
                      value={payMonth}
                      onChange={(e) => {
                        setPayMonth(e.target.value);
                        clearPreview();
                      }}
                      className="font-mono"
                    />
                  </div>

                  {periodLabel ? (
                    <p className="rounded-md border border-dashed border-[#233981]/40 bg-[#233981]/5 px-3 py-2 text-sm">
                      <span className="font-medium text-[#233981]">Periodo: </span>
                      {periodLabel}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    className="w-full"
                    variant="secondary"
                    disabled={isPreviewing || !selectedEmployee}
                    onClick={onPreview}
                  >
                    <Play className="mr-2 size-4" aria-hidden />
                    {isPreviewing ? 'Calculando…' : 'Vista previa'}
                  </Button>

                  {previewData ? (
                    <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Neto</span>
                        <MoneyLabel amount={previewData.neto} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Deducciones</span>
                        <MoneyLabel amount={previewData.totalDeducciones} />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      type="button"
                      disabled={isGenerating || !selectedEmployee || !previewData}
                      onClick={onGeneratePdf}
                    >
                      <FileDown className="mr-2 size-4" aria-hidden />
                      {isGenerating ? 'Generando PDF…' : 'Exportar PDF (generar)'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isSendingEmails || !selectedEmployee || !previewData}
                      onClick={() => void onSendEmailForSelected()}
                    >
                      <Mail className="mr-2 size-4" aria-hidden />
                      {isSendingEmails ? 'Enviando…' : 'Enviar correo'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={isSendingEmails || isGenerating || !selectedEmployee || !previewData}
                      onClick={() => void onPdfAndEmailForSelected()}
                    >
                      PDF + correo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex min-h-[480px] flex-col border-border/60">
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle className="text-base">Vista previa de boleta</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col p-0">
                  {message ? <p className="px-4 pt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
                  {error ? <p className="px-4 pt-3 text-sm text-destructive">{error}</p> : null}
                  {previewHtml ? (
                    <iframe
                      title="Vista previa de boleta"
                      className="min-h-[420px] w-full flex-1 border-0 bg-white"
                      srcDoc={previewHtml}
                      sandbox=""
                    />
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                      <p className="text-sm">Seleccione un empleado y pulse Vista previa.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <PlanillaMonthEmailPanel payMonth={payMonth} />
          </PayrollChrome>
        </div>

        <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generar todos — {payMonth}</DialogTitle>
              <DialogDescription>
                {isBatching
                  ? 'Procesando empleados habilitados…'
                  : batchConfirmed && batchResult
                    ? 'Resumen del lote'
                    : 'Seleccione el modo de entrega'}
              </DialogDescription>
            </DialogHeader>
            {!batchConfirmed && !isBatching ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  {(
                    [
                      ['pdf', 'Solo PDF'],
                      ['email', 'Solo correo'],
                      ['both', 'PDF + correo'],
                    ] as const
                  ).map(([mode, label]) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={batchMode === mode ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => setBatchMode(mode)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Button type="button" className="w-full" onClick={() => void onConfirmBatch()}>
                  Iniciar generación
                </Button>
              </div>
            ) : null}
            {isBatching ? (
              <p className="text-sm text-muted-foreground">Espere un momento…</p>
            ) : batchConfirmed && batchResult ? (
              <div className="space-y-2 text-sm">
                <p>
                  Total: {batchResult.results?.length ?? 0} ·{' '}
                  <span className="font-medium text-emerald-600">{batchResult.succeeded}</span> exitosos ·{' '}
                  <span className="font-medium text-destructive">{batchResult.failed}</span> fallidos
                </p>
                {batchResult.results?.length ? (
                  <ul className="max-h-48 overflow-y-auto rounded-md border p-2 text-xs">
                    {batchResult.results.map((r) => (
                      <li key={r.employeeId} className={r.ok ? 'text-emerald-700' : 'text-destructive'}>
                        {r.ok ? '✓' : '✗'} {employeeNameById.get(r.employeeId) ?? r.employeeId}
                        {r.error ? ` — ${r.error}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </MainLayout>
  );
}
