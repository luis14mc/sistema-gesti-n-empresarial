'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createSubscriptionSchema } from '@/lib/software-licenses/schemas';
import { billingEquivalents, formatPaymentSchedule } from '@/lib/software-licenses/billing';
import { moneyLabel } from '@/components/software-licenses/labels';
import { api } from '@/utils/api';
import { cn } from '@/lib/utils';

type SubscriptionFormInput = z.input<typeof createSubscriptionSchema>;
type SubscriptionFormOutput = z.output<typeof createSubscriptionSchema>;

const DEFAULTS: SubscriptionFormInput = {
  productName: '',
  vendor: '',
  category: '',
  description: '',
  website: '',
  planName: '',
  totalSeats: 1,
  billingCycle: 'MONTHLY',
  currency: 'USD',
  billingAmount: 0,
  startDate: '',
  renewalDate: null,
  paymentDay: null,
  autoRenew: true,
  notes: '',
  expiringSoonDays: 30,
};

function emptyToNull(value: string) {
  const text = value.trim();
  return text ? text : null;
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: FieldErrors<SubscriptionFormInput>[keyof SubscriptionFormInput];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error?.message ? <p className="text-xs text-destructive">{error.message}</p> : null}
    </div>
  );
}

function CostPreview({ control }: { control: Control<SubscriptionFormInput> }) {
  const cycle = useWatch({ control, name: 'billingCycle', defaultValue: 'MONTHLY' });
  const amount = useWatch({ control, name: 'billingAmount', defaultValue: 0 });
  const currency = useWatch({ control, name: 'currency', defaultValue: 'USD' });
  const paymentDay = useWatch({ control, name: 'paymentDay', defaultValue: null });
  const renewalDate = useWatch({ control, name: 'renewalDate', defaultValue: null });
  const seats = useWatch({ control, name: 'totalSeats', defaultValue: 1 });
  const numericAmount = typeof amount === 'number' ? amount : Number(amount);
  const numericSeats = typeof seats === 'number' ? seats : Number(seats);
  const costs = billingEquivalents(cycle, Number.isFinite(numericAmount) ? numericAmount : 0);
  const schedule = formatPaymentSchedule({
    billingCycle: cycle,
    paymentDay: typeof paymentDay === 'number' ? paymentDay : null,
    renewalDate: typeof renewalDate === 'string' ? renewalDate : null,
  });

  return (
    <dl className="grid gap-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">Asientos vacíos</dt>
        <dd className="font-medium tabular-nums">{Number.isFinite(numericSeats) ? numericSeats : 0}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">Equivalente mensual</dt>
        <dd className="font-medium tabular-nums">{moneyLabel(currency, costs.monthlyCost)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">Equivalente anual</dt>
        <dd className="font-medium tabular-nums">{moneyLabel(currency, costs.annualCost)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-muted-foreground">Próximo pago</dt>
        <dd className="font-medium">{schedule}</dd>
      </div>
    </dl>
  );
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function RegisterLicensePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const form = useForm<SubscriptionFormInput, unknown, SubscriptionFormOutput>({
    resolver: zodResolver(createSubscriptionSchema),
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues: DEFAULTS,
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError('');
    try {
      const response = await api.post('/api/software-licenses', {
        ...values,
        vendor: emptyToNull(values.vendor ?? ''),
        category: emptyToNull(values.category ?? ''),
        description: emptyToNull(values.description ?? ''),
        website: emptyToNull(values.website ?? ''),
        notes: emptyToNull(values.notes ?? ''),
        renewalDate: values.renewalDate || null,
        paymentDay: values.paymentDay || null,
      });
      const id = response.data.data.id as string;
      router.push(`/equipment/licencias/${id}`);
    } catch {
      setError('No se pudo registrar la licencia. Revisa los datos e inténtalo de nuevo.');
    }
  });

  return (
    <MainLayout>
      <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Registrar licencia"
          description="Crea el producto, la suscripción y los asientos disponibles. Las personas se asignan después, desde el catálogo de empleados."
          breadcrumbs={[
            { label: 'Activos', href: '/equipment' },
            { label: 'Licencias', href: '/equipment/licencias' },
            { label: 'Registrar' },
          ]}
          primaryAction={<Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Registrar licencia'}</Button>}
          secondaryActions={<Button type="button" variant="outline" onClick={() => router.push('/equipment/licencias')}>Cancelar</Button>}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Software</CardTitle>
                <CardDescription>El producto queda en el catálogo de la organización. No se duplica si el nombre ya existe.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="productName" error={errors.productName} className="sm:col-span-2">
                  <Input id="productName" {...form.register('productName')} />
                </Field>
                <Field label="Proveedor" htmlFor="vendor" error={errors.vendor}>
                  <Input id="vendor" {...form.register('vendor')} />
                </Field>
                <Field label="Categoría" htmlFor="category" error={errors.category}>
                  <Input id="category" {...form.register('category')} />
                </Field>
                <Field label="Sitio web" htmlFor="website" error={errors.website} className="sm:col-span-2">
                  <Input id="website" {...form.register('website')} placeholder="https://" />
                </Field>
                <Field label="Descripción" htmlFor="description" error={errors.description} className="sm:col-span-2">
                  <Textarea id="description" rows={3} {...form.register('description')} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Suscripción</CardTitle>
                <CardDescription>Cada asiento nace disponible e individual. Una cuenta compartida se marca después, cuando tenga más de una persona.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Plan" htmlFor="planName" error={errors.planName}>
                  <Input id="planName" {...form.register('planName')} />
                </Field>
                <Field label="Asientos contratados" htmlFor="totalSeats" error={errors.totalSeats}>
                  <Input id="totalSeats" type="number" min={1} {...form.register('totalSeats', { valueAsNumber: true })} />
                </Field>
                <Field label="Notas" htmlFor="notes" error={errors.notes} className="sm:col-span-2">
                  <Textarea id="notes" rows={2} {...form.register('notes')} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Facturación</CardTitle>
                <CardDescription>El monto es del ciclo elegido. El tablero calcula el equivalente mensual y anual.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Ciclo" htmlFor="billingCycle" error={errors.billingCycle}>
                  <select id="billingCycle" className={selectClass} {...form.register('billingCycle')}>
                    <option value="MONTHLY">Mensual</option>
                    <option value="ANNUAL">Anual</option>
                    <option value="QUARTERLY">Trimestral</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </Field>
                <Field label="Moneda" htmlFor="currency" error={errors.currency}>
                  <select id="currency" className={selectClass} {...form.register('currency')}>
                    <option value="USD">USD</option>
                    <option value="HNL">HNL</option>
                  </select>
                </Field>
                <Field label="Monto del ciclo" htmlFor="billingAmount" error={errors.billingAmount}>
                  <Input id="billingAmount" type="number" min={0} step="0.01" {...form.register('billingAmount', { valueAsNumber: true })} />
                </Field>
                <Field label="Inicio" htmlFor="startDate" error={errors.startDate}>
                  <Input id="startDate" type="date" {...form.register('startDate')} />
                </Field>
                <Field label="Día de pago" htmlFor="paymentDay" hint="Para un mensual, 5 se muestra como “5 de cada mes”." error={errors.paymentDay}>
                  <Input id="paymentDay" type="number" min={1} max={31} {...form.register('paymentDay', { setValueAs: (value: string) => value === '' ? null : Number(value) })} />
                </Field>
                <Field label="Fecha de renovación" htmlFor="renewalDate" hint="Úsala cuando el vencimiento es un día concreto." error={errors.renewalDate}>
                  <Input id="renewalDate" type="date" {...form.register('renewalDate', { setValueAs: (value: string) => value === '' ? null : value })} />
                </Field>
                <Field label="Aviso de vencimiento (días)" htmlFor="expiringSoonDays" error={errors.expiringSoonDays}>
                  <Input id="expiringSoonDays" type="number" min={1} max={365} {...form.register('expiringSoonDays', { valueAsNumber: true })} />
                </Field>
                <div className="flex items-center gap-2 sm:pt-7">
                  <input id="autoRenew" type="checkbox" className="size-4 rounded border" {...form.register('autoRenew')} />
                  <Label htmlFor="autoRenew" className="font-normal">Renovación automática</Label>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
              <CardDescription>Los asientos quedan sin asignar hasta que elijas un empleado activo.</CardDescription>
            </CardHeader>
            <CardContent>
              <CostPreview control={form.control} />
            </CardContent>
          </Card>
        </div>
      </form>
    </MainLayout>
  );
}
