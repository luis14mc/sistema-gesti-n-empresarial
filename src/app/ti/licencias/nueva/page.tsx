'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  emptyToNull,
  SUBSCRIPTION_FORM_DEFAULTS,
  SubscriptionForm,
  type SubscriptionFormOutput,
} from '@/components/software-licenses/SubscriptionForm';
import { api } from '@/utils/api';

const FORM_ID = 'register-license-form';

export default function RegisterLicensePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(values: SubscriptionFormOutput) {
    setError('');
    setIsSubmitting(true);
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
      router.push(`/ti/licencias/${id}`);
    } catch {
      setError('No se pudo registrar la licencia. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Registrar licencia"
          description="Crea el producto, la suscripción y los asientos disponibles. Las personas se asignan después, desde el detalle."
          breadcrumbs={[
            { label: 'Activos', href: '/equipment' },
            { label: 'Licencias', href: '/ti/licencias' },
            { label: 'Registrar' },
          ]}
          primaryAction={
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Registrar licencia'}
            </Button>
          }
          secondaryActions={
            <Button type="button" variant="outline" onClick={() => router.push('/ti/licencias')}>
              Cancelar
            </Button>
          }
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <SubscriptionForm mode="create" formId={FORM_ID} defaultValues={SUBSCRIPTION_FORM_DEFAULTS} onSubmit={onSubmit} />
      </div>
    </MainLayout>
  );
}
