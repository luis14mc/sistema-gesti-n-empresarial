'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  emptyToNull,
  SUBSCRIPTION_FORM_DEFAULTS,
  SubscriptionForm,
  type SubscriptionFormInput,
  type SubscriptionFormOutput,
} from '@/components/software-licenses/SubscriptionForm';
import { api } from '@/utils/api';

const FORM_ID = 'edit-license-form';

function isoDate(value: string | Date | null | undefined) {
  if (!value) return '';
  const text = typeof value === 'string' ? value : value.toISOString();
  return text.slice(0, 10);
}

export default function EditLicensePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initial, setInitial] = useState<SubscriptionFormInput | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/software-licenses/${params.id}`)
      .then((response) => {
        if (cancelled) return;
        const data = response.data.data;
        setInitial({
          productName: data.product.name ?? '',
          vendor: data.product.vendor ?? '',
          category: data.product.category ?? '',
          description: data.product.description ?? '',
          website: data.product.website ?? '',
          planName: data.planName ?? '',
          totalSeats: data.totalSeats ?? 1,
          billingCycle: data.billingCycle,
          currency: data.currency,
          billingAmount: data.billingAmount ?? 0,
          startDate: isoDate(data.startDate),
          renewalDate: data.renewalDate ? isoDate(data.renewalDate) : null,
          paymentDay: data.paymentDay ?? null,
          autoRenew: data.autoRenew ?? true,
          notes: data.notes ?? '',
          expiringSoonDays: data.expiringSoonDays ?? 30,
          status: data.status ?? 'ACTIVE',
        });
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la suscripción.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const defaultValues = useMemo(() => initial ?? SUBSCRIPTION_FORM_DEFAULTS, [initial]);

  async function onSubmit(values: SubscriptionFormOutput & { status?: SubscriptionFormInput['status'] }) {
    setError('');
    setIsSubmitting(true);
    try {
      await api.patch(`/api/software-licenses/${params.id}`, {
        ...values,
        vendor: emptyToNull(values.vendor ?? ''),
        category: emptyToNull(values.category ?? ''),
        description: emptyToNull(values.description ?? ''),
        website: emptyToNull(values.website ?? ''),
        notes: emptyToNull(values.notes ?? ''),
        renewalDate: values.renewalDate || null,
        paymentDay: values.paymentDay || null,
        status: values.status,
      });
      router.push(`/activos/licencias/${params.id}`);
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setError(message ?? 'No se pudo guardar la licencia.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Editar licencia"
          description="Actualiza plan, facturación, asientos contratados y estado administrativo."
          breadcrumbs={[
            { label: 'Activos', href: '/activos/equipos' },
            { label: 'Licencias', href: '/activos/licencias' },
            { label: 'Detalle', href: `/activos/licencias/${params.id}` },
            { label: 'Editar' },
          ]}
          primaryAction={
            <Button type="submit" form={FORM_ID} disabled={isSubmitting || loading || !initial}>
              {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          }
          secondaryActions={
            <Button type="button" variant="outline" asChild>
              <Link href={`/activos/licencias/${params.id}`}>Volver al detalle</Link>
            </Button>
          }
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : initial ? (
          <SubscriptionForm key={params.id} mode="edit" formId={FORM_ID} defaultValues={defaultValues} onSubmit={onSubmit} />
        ) : null}
      </div>
    </MainLayout>
  );
}
