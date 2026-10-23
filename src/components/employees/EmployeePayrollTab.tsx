'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiHelpers } from '@/utils/api';
import { sileo } from 'sileo';

type Props = {
  employeeId: string;
  canEdit: boolean;
};

type PayrollDetail = {
  monthlySalary: number | null;
  otherDeduction: number;
  otherDeductionNote: string | null;
  payrollEnabled: boolean;
};

export function EmployeePayrollTab({ employeeId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PayrollDetail>({
    monthlySalary: null,
    otherDeduction: 0,
    otherDeductionNote: '',
    payrollEnabled: false,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiHelpers
      .get<{ success?: boolean; data: PayrollDetail }>(`/api/payroll/employees/${employeeId}`)
      .then((res) => {
        if (cancelled) return;
        const row = res.data.data ?? (res.data as unknown as PayrollDetail);
        setForm({
          monthlySalary: row.monthlySalary,
          otherDeduction: Number(row.otherDeduction ?? 0),
          otherDeductionNote: row.otherDeductionNote ?? '',
          payrollEnabled: Boolean(row.payrollEnabled),
        });
      })
      .catch(() => {
        if (!cancelled) sileo.error({ title: 'No se pudo cargar planilla' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  async function save() {
    setSaving(true);
    try {
      await apiHelpers.patch(`/api/payroll/employees/${employeeId}`, {
        monthlySalary: form.monthlySalary,
        otherDeduction: form.otherDeduction,
        otherDeductionNote: form.otherDeductionNote || null,
        payrollEnabled: form.payrollEnabled,
      });
      sileo.success({ title: 'Planilla actualizada' });
    } catch {
      sileo.error({ title: 'No se pudo guardar planilla' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="payroll-enabled">Habilitado en planilla</Label>
        <Switch
          id="payroll-enabled"
          checked={form.payrollEnabled}
          disabled={!canEdit}
          onCheckedChange={(checked) => setForm((f) => ({ ...f, payrollEnabled: checked }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="monthly-salary">Salario mensual</Label>
        <Input
          id="monthly-salary"
          type="number"
          min={0}
          step="0.01"
          disabled={!canEdit}
          value={form.monthlySalary ?? ''}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              monthlySalary: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="other-deduction">Otra deducción</Label>
        <Input
          id="other-deduction"
          type="number"
          min={0}
          step="0.01"
          disabled={!canEdit}
          value={form.otherDeduction}
          onChange={(e) => setForm((f) => ({ ...f, otherDeduction: Number(e.target.value) }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="deduction-note">Nota de deducción</Label>
        <Input
          id="deduction-note"
          disabled={!canEdit}
          value={form.otherDeductionNote ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, otherDeductionNote: e.target.value }))}
        />
      </div>
      {canEdit ? (
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar planilla'}
        </Button>
      ) : null}
    </div>
  );
}
