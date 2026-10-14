'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Search } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { PayrollChrome, planillaBreadcrumbs } from '@/components/payroll/payroll-chrome';
import { PayrollStatGrid } from '@/components/payroll/payroll-stat-grid';
import { PayrollTable, type PayrollTableColumn } from '@/components/payroll/payroll-table';
import { MoneyLabel } from '@/components/payroll/money-label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePayrollEmployee, usePayrollEmployees, usePayrollMutations } from '@/hooks/usePayroll';
import type { PayrollEmployeeListItem } from '@/services/payroll.service';

function defaultPayMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-HN');
}

export default function PlanillaEmpleadosPage() {
  const previewPayMonth = defaultPayMonth();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const { employees, stats: payrollStats, total, isLoading, refetch } = usePayrollEmployees({
    search: search || undefined,
    previewPayMonth,
    pageSize: 100,
  });
  const { patchEmployee, isPatching } = usePayrollMutations();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const stats = useMemo(
    () => ({
      total: payrollStats?.totalPayrollEmployees ?? total,
      totalPayroll: payrollStats?.totalMonthlyPayroll ?? 0,
      avg: payrollStats?.averageMonthlySalary ?? 0,
    }),
    [payrollStats, total],
  );

  const columns: PayrollTableColumn<PayrollEmployeeListItem>[] = [
    {
      id: 'name',
      header: 'Empleado',
      cell: (e) => (
        <div>
          <p className="font-medium">{e.fullName}</p>
          {e.employeeCode ? <p className="text-xs text-muted-foreground">{e.employeeCode}</p> : null}
        </div>
      ),
    },
    {
      id: 'dept',
      header: 'Área',
      cell: (e) => e.department?.name ?? e.position?.name ?? '—',
    },
    {
      id: 'salary',
      header: 'Salario mensual',
      align: 'right',
      money: true,
      cell: (e) => e.monthlySalary,
    },
    {
      id: 'ihss',
      header: 'IHSS (prev.)',
      align: 'right',
      money: true,
      cell: (e) => e.previewIhss ?? null,
    },
    {
      id: 'isr',
      header: 'ISR (prev.)',
      align: 'right',
      money: true,
      cell: (e) => e.previewIsr ?? null,
    },
    {
      id: 'status',
      header: 'Planilla',
      align: 'center',
      cell: (e) =>
        e.payrollEnabled ? (
          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Activo
          </Badge>
        ) : (
          <Badge variant="outline">Inactivo</Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (e) => (
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(e.id)}>
          <Pencil className="size-4" aria-hidden />
          <span className="sr-only">Editar {e.fullName}</span>
        </Button>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader
          title="Personal"
          description="Salarios, deducciones y datos de contacto para la planilla."
          breadcrumbs={planillaBreadcrumbs('Personal')}
        />
        <PayrollChrome>
          <PayrollStatGrid
            items={[
              { label: 'Empleados', value: stats.total },
              {
                label: 'Planilla mensual total',
                value: <MoneyLabel amount={stats.totalPayroll} />,
                hint: 'Suma de salarios mensuales registrados',
              },
              {
                label: 'Salario promedio',
                value: <MoneyLabel amount={stats.avg} />,
              },
            ]}
          />

          <Card className="border-border/60">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Empleados en planilla</CardTitle>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar nombre, código o correo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {notice ? <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p> : null}
              {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
              <PayrollTable
                columns={columns}
                rows={employees}
                rowKey={(e) => e.id}
                isLoading={isLoading}
                emptyMessage="No hay empleados que coincidan con la búsqueda."
              />
              <p className="mt-3 text-xs text-muted-foreground">
                IHSS e ISR de vista previa para {previewPayMonth} cuando el API los incluye.
              </p>
            </CardContent>
          </Card>
        </PayrollChrome>
      </div>

      <EmployeePayrollDialog
        employeeId={editId}
        open={editId != null}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
        isSaving={isPatching}
        onSave={async (id, data) => {
          setError('');
          setNotice('');
          try {
            await patchEmployee({ id, data });
            setNotice('Cambios guardados.');
            await refetch();
            setEditId(null);
          } catch {
            setError('No se pudo guardar el empleado.');
          }
        }}
      />
    </MainLayout>
  );
}

function EmployeePayrollDialog({
  employeeId,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
}) {
  const { employee, isLoading } = usePayrollEmployee(employeeId);
  const [salary, setSalary] = useState('');
  const [deduction, setDeduction] = useState('');
  const [deductionNote, setDeductionNote] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setSalary(employee.monthlySalary != null ? String(employee.monthlySalary) : '');
    setDeduction(String(employee.otherDeduction ?? 0));
    setDeductionNote(employee.otherDeductionNote ?? '');
    setEnabled(employee.payrollEnabled);
  }, [open, employee]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar empleado — planilla</DialogTitle>
        </DialogHeader>
        {isLoading || !employee ? (
          <p className="text-sm text-muted-foreground">Cargando datos…</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-[#233981]">Información del empleado</h3>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Nombre</dt>
                  <dd className="text-right font-medium">{employee.fullName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Código</dt>
                  <dd>{employee.employeeCode ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Ingreso</dt>
                  <dd>{formatDate(employee.hireDate)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Departamento</dt>
                  <dd>{employee.department?.name ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Puesto</dt>
                  <dd>{employee.position?.name ?? '—'}</dd>
                </div>
              </dl>
            </section>
            <Separator />
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-[#233981]">Deducciones y salario</h3>
              <div className="space-y-2">
                <Label htmlFor="monthlySalary">Salario mensual (L)</Label>
                <Input
                  id="monthlySalary"
                  inputMode="decimal"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherDeduction">Otra deducción (L)</Label>
                <Input
                  id="otherDeduction"
                  inputMode="decimal"
                  value={deduction}
                  onChange={(e) => setDeduction(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherDeductionNote">Nota de deducción</Label>
                <Textarea
                  id="otherDeductionNote"
                  rows={2}
                  value={deductionNote}
                  onChange={(e) => setDeductionNote(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <Label htmlFor="payrollEnabled">Incluir en planilla</Label>
                <Switch id="payrollEnabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </section>
            <Separator />
            <section>
              <h3 className="mb-3 text-sm font-semibold text-[#233981]">Contacto</h3>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Correo</dt>
                  <dd className="break-all text-right">{employee.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd>{employee.phone ?? '—'}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSaving || !employee}
            onClick={() => {
              if (!employee) return;
              void onSave(employee.id, {
                monthlySalary: salary === '' ? null : Number(salary),
                otherDeduction: Number(deduction) || 0,
                otherDeductionNote: deductionNote.trim() || null,
                payrollEnabled: enabled,
              });
            }}
          >
            {isSaving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
