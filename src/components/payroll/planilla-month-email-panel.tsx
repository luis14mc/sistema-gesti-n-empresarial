'use client';

import { useMemo, useState } from 'react';
import { Eye, Mail, RefreshCw } from 'lucide-react';
import { PayrollTable, type PayrollTableColumn } from '@/components/payroll/payroll-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { usePayrollMutations, usePayrollPayslips } from '@/hooks/usePayroll';
import { payrollService, type PayslipListItem } from '@/services/payroll.service';

function parsePayMonth(payMonth: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(payMonth);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function emailStatusLabel(status: string | undefined) {
  if (status === 'SENT') return 'Enviado';
  if (status === 'FAILED') return 'Fallido';
  return 'Pendiente';
}

function emailStatusVariant(status: string | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'SENT') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

type ConfirmMode = 'all' | 'failed' | 'one' | 'force';

export function PlanillaMonthEmailPanel({ payMonth }: { payMonth: string }) {
  const period = parsePayMonth(payMonth);
  const { payslips, isLoading, refetch } = usePayrollPayslips(
    period
      ? { year: period.year, month: period.month, page: 1, pageSize: 500 }
      : { page: 1, pageSize: 1 },
  );
  const { sendPayslipEmails, isSendingEmails, emailSendResult } = usePayrollMutations();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>('all');
  const [targetPayslip, setTargetPayslip] = useState<PayslipListItem | null>(null);
  const [error, setError] = useState('');

  const counts = useMemo(() => {
    const pending = payslips.filter((p) => !p.emailStatus || p.emailStatus === 'NONE').length;
    const sent = payslips.filter((p) => p.emailStatus === 'SENT').length;
    const failed = payslips.filter((p) => p.emailStatus === 'FAILED').length;
    return { pending, sent, failed, total: payslips.length };
  }, [payslips]);

  const confirmCount = useMemo(() => {
    if (confirmMode === 'failed') return counts.failed;
    if (confirmMode === 'one' && targetPayslip) return 1;
    if (confirmMode === 'force' && targetPayslip) return 1;
    return payslips.filter((p) => p.emailStatus !== 'SENT').length;
  }, [confirmMode, counts, payslips, targetPayslip]);

  async function runSend() {
    if (!period) return;
    setError('');
    try {
      await sendPayslipEmails({
        year: period.year,
        month: period.month,
        employeeIds:
          confirmMode === 'one' || confirmMode === 'force'
            ? targetPayslip
              ? [targetPayslip.employeeId]
              : undefined
            : undefined,
        failedOnly: confirmMode === 'failed',
        force: confirmMode === 'force',
      });
      setConfirmOpen(false);
      await refetch();
    } catch {
      setError('No se pudo completar el envío por correo.');
    }
  }

  function openConfirm(mode: ConfirmMode, payslip?: PayslipListItem) {
    setConfirmMode(mode);
    setTargetPayslip(payslip ?? null);
    setConfirmOpen(true);
  }

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
      id: 'neto',
      header: 'Neto',
      align: 'right',
      money: true,
      cell: (p) => p.neto,
    },
    {
      id: 'email',
      header: 'Correo',
      cell: (p) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={emailStatusVariant(p.emailStatus)}>{emailStatusLabel(p.emailStatus)}</Badge>
          </TooltipTrigger>
          {p.emailError ? <TooltipContent>{p.emailError}</TooltipContent> : null}
        </Tooltip>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button type="button" size="sm" variant="ghost" asChild>
            <a href={payrollService.pdfUrl(p.id)} target="_blank" rel="noreferrer">
              <Eye className="size-4" aria-hidden />
              <span className="sr-only">Ver PDF</span>
            </a>
          </Button>
          {p.emailStatus !== 'SENT' ? (
            <Button type="button" size="sm" variant="outline" onClick={() => openConfirm('one', p)}>
              <Mail className="size-4" aria-hidden />
              <span className="sr-only">Enviar</span>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => openConfirm('force', p)}>
              <RefreshCw className="size-4" aria-hidden />
              <span className="sr-only">Reenviar</span>
            </Button>
          )}
          {p.emailStatus === 'FAILED' ? (
            <Button type="button" size="sm" variant="outline" onClick={() => openConfirm('one', p)}>
              Reintentar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  if (!period) return null;

  const progressPct =
    emailSendResult && emailSendResult.pending >= 0
      ? Math.min(
          100,
          Math.round(
            ((emailSendResult.sent + emailSendResult.failed) /
              Math.max(emailSendResult.sent + emailSendResult.failed + emailSendResult.pending, 1)) *
              100,
          ),
        )
      : isSendingEmails
        ? 35
        : 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">Boletas del mes — {payMonth}</CardTitle>
          <CardDescription>
            {counts.total} recibos · {counts.sent} enviados · {counts.failed} fallidos · {counts.pending} pendientes
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isSendingEmails || counts.total === 0}
            onClick={() => openConfirm('all')}
          >
            <Mail className="mr-2 size-4" aria-hidden />
            Enviar boletas por correo
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSendingEmails || counts.failed === 0}
            onClick={() => openConfirm('failed')}
          >
            Reenviar fallidas
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {isSendingEmails ? (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-[#233981] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Enviando boletas…</p>
          </div>
        ) : null}
        {emailSendResult ? (
          <p className="text-sm text-muted-foreground">
            Resultado: {emailSendResult.sent} enviados, {emailSendResult.failed} fallidos
            {emailSendResult.pending > 0 ? `, ${emailSendResult.pending} pendientes (reintente el envío)` : null}.
          </p>
        ) : null}
        <PayrollTable columns={columns} rows={payslips} rowKey={(p) => p.id} isLoading={isLoading} />
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envío por correo</DialogTitle>
            <DialogDescription>
              Se procesarán {confirmCount} boleta(s) para {payMonth}.
              {confirmMode === 'force' ? ' Se reenviará una boleta ya marcada como enviada.' : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSendingEmails} onClick={runSend}>
              {isSendingEmails ? 'Enviando…' : 'Confirmar envío'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
