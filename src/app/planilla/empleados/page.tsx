'use client';

import { useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePayrollEmployees, usePayrollMutations } from '@/hooks/usePayroll';
import type { PayrollEmployeeListItem } from '@/services/payroll.service';

export default function PlanillaEmpleadosPage() {
  const [search, setSearch] = useState('');
  const { employees, isLoading, refetch } = usePayrollEmployees({ search: search || undefined });
  const { patchEmployee, isPatching } = usePayrollMutations();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function saveRow(
    id: string,
    data: { monthlySalary?: number | null; payrollEnabled?: boolean; otherDeduction?: number },
  ) {
    setError('');
    setNotice('');
    try {
      await patchEmployee({ id, data });
      setNotice('Cambios guardados.');
      await refetch();
    } catch {
      setError('No se pudo guardar el empleado.');
    }
  }

  return (
    <MainLayout>
      <PageHeader
        title="Empleados — planilla"
        description="Salario, deducciones y habilitación para nómina."
        breadcrumbs={[
          { label: 'Personas', href: '/employees' },
          { label: 'Planilla', href: '/planilla' },
          { label: 'Empleados' },
        ]}
        secondaryActions={<Button variant="outline" asChild><Link href="/planilla">Generación</Link></Button>}
      />
      <div className="space-y-4 p-4 md:p-6">
        <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Card>
          <CardHeader><CardTitle>Listado</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
            <div className="space-y-6">
              {employees.map((row: PayrollEmployeeListItem) => {
                const e = row;
                return (
                  <EmployeePayrollRow
                    key={e.id}
                    employee={e}
                    disabled={isPatching}
                    onSave={saveRow}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function EmployeePayrollRow({
  employee,
  disabled,
  onSave,
}: {
  employee: {
    id: string;
    fullName: string;
    monthlySalary: number | null;
    otherDeduction: number;
    payrollEnabled: boolean;
  };
  disabled: boolean;
  onSave: (id: string, data: { monthlySalary?: number | null; payrollEnabled?: boolean; otherDeduction?: number }) => void;
}) {
  const [salary, setSalary] = useState(employee.monthlySalary?.toString() ?? '');
  const [deduction, setDeduction] = useState(String(employee.otherDeduction));
  const [enabled, setEnabled] = useState(employee.payrollEnabled);

  return (
    <div className="grid gap-3 border-b pb-4 md:grid-cols-[1fr_repeat(3,minmax(0,140px))_auto] md:items-end">
      <div>
        <p className="font-medium">{employee.fullName}</p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Salario mensual</label>
        <Input value={salary} onChange={(ev) => setSalary(ev.target.value)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Otra deducción</label>
        <Input value={deduction} onChange={(ev) => setDeduction(ev.target.value)} />
      </div>
      <div className="flex items-center gap-2 pt-6">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(ev) => setEnabled(ev.target.checked)}
          id={`pe-${employee.id}`}
        />
        <label htmlFor={`pe-${employee.id}`} className="text-sm">En planilla</label>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onSave(employee.id, {
            monthlySalary: salary === '' ? null : Number(salary),
            otherDeduction: Number(deduction) || 0,
            payrollEnabled: enabled,
          })
        }
      >
        Guardar
      </Button>
    </div>
  );
}
