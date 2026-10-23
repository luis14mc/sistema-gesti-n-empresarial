'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/utils/api';
import { moneyLabel, STATUS_LABEL } from '@/components/software-licenses/labels';
import { formatPaymentSchedule } from '@/modules/software-licenses/domain/billing';
import { AddLicenseForm } from '@/components/software-licenses/AddLicenseForm';
import { LicenseSeatsTable, type LicenseSeatRow } from '@/components/software-licenses/LicenseSeatsTable';
import { DeleteLicenseConfirmDialog } from '@/components/software-licenses/DeleteLicenseConfirmDialog';
import { canManageSoftwareLicenses } from '@/components/software-licenses/can-manage-licenses';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/platform/security/session-module-access';

type Detail = {
  id: string;
  planName: string;
  currency: string;
  monthlyCost: number;
  unitMonthlyCost: number;
  displayStatus: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  billingCycle: 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'OTHER';
  paymentDay: number | null;
  renewalDate: string | null;
  product: { name: string };
  counts: {
    contractedSeats: number;
    registeredSeats: number;
    inUseSeats: number;
    freeSeats: number;
    exceedsContract: boolean;
  };
  hasAssignmentHistory?: boolean;
  activeAssignmentCount?: number;
  seats: LicenseSeatRow[];
};

export default function SoftwareLicenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;
  const canUpdate = role ? canAccess(role, 'software-licenses', 'update') : false;
  const canManage = canManageSoftwareLicenses(user);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [showCancelledSeats, setShowCancelledSeats] = useState(false);
  const [deleteSubscriptionOpen, setDeleteSubscriptionOpen] = useState(false);
  const [deleteSubscriptionPending, setDeleteSubscriptionPending] = useState(false);

  async function reload() {
    const response = await api.get(`/api/software-licenses/${params.id}`);
    setDetail(response.data.data as Detail);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/software-licenses/${params.id}`)
      .then((response) => {
        if (!cancelled) setDetail(response.data.data as Detail);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo abrir la suscripción.');
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await reload();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'La operación no se completó.');
    }
  }

  const visibleSeats = useMemo(() => {
    if (!detail) return [];
    if (showCancelledSeats) return detail.seats;
    return detail.seats.filter((seat) => seat.status !== 'CANCELLED');
  }, [detail, showCancelledSeats]);

  const hasCancelledSeats = Boolean(detail?.seats.some((seat) => seat.status === 'CANCELLED'));

  async function confirmDeleteSubscription() {
    if (!detail) return;
    setDeleteSubscriptionPending(true);
    setError('');
    try {
      const response = await api.delete(`/api/software-licenses/${detail.id}`);
      const outcome = response.data.data?.outcome as string | undefined;
      if (outcome === 'DELETED' || outcome === 'CANCELLED') {
        router.push('/activos/licencias');
        return;
      }
      await reload();
      setDeleteSubscriptionOpen(false);
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'No se pudo eliminar la suscripción.');
    } finally {
      setDeleteSubscriptionPending(false);
    }
  }

  return (
    <MainLayout>
      <PageHeader
        title={detail?.product.name ?? 'Suscripción'}
        description={
          detail
            ? `${detail.planName} · ${detail.counts.contractedSeats} contratadas · ${detail.counts.registeredSeats} registradas · ${detail.counts.inUseSeats} en uso · ${detail.counts.freeSeats} libres · ${moneyLabel(detail.currency, detail.monthlyCost)} / mes (${moneyLabel(detail.currency, detail.unitMonthlyCost)} / licencia contratada)`
            : 'Cargando'
        }
        breadcrumbs={[
          { label: 'Activos', href: '/activos/equipos' },
          { label: 'Licencias', href: '/activos/licencias' },
          { label: detail?.product.name ?? 'Detalle' },
        ]}
        primaryAction={
          detail && canUpdate ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => run(() => api.post(`/api/software-licenses/${detail.id}/renew`, {}))}>
                Registrar renovación
              </Button>
              <Button asChild>
                <Link href={`/activos/licencias/${detail.id}/editar`}>Editar contrato</Link>
              </Button>
            </div>
          ) : undefined
        }
      />
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {detail ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Próximo pago: {formatPaymentSchedule(detail)} ·{' '}
          <Badge variant="outline">{STATUS_LABEL[detail.displayStatus] ?? detail.displayStatus}</Badge>
          {detail.counts.exceedsContract ? (
            <Badge variant="destructive" className="ml-2">
              Excede lo contratado
            </Badge>
          ) : null}
        </p>
      ) : null}

      {detail && canUpdate ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="font-medium">Agregar licencia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre cuentas personales, compartidas o claves ligadas a un equipo.
          </p>
          <div className="mt-4">
            <AddLicenseForm subscriptionId={detail.id} onCreated={reload} />
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Licencias registradas</h2>
          {hasCancelledSeats ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showCancelledSeats}
                onChange={(event) => setShowCancelledSeats(event.target.checked)}
              />
              Mostrar dadas de baja
            </label>
          ) : null}
        </div>
        {detail ? (
          <LicenseSeatsTable
            seats={visibleSeats}
            canUpdate={canUpdate}
            canManage={canManage}
            onChange={reload}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        )}
      </section>

      {detail && canManage && detail.status !== 'CANCELLED' ? (
        <section className="mt-10 border-t pt-6">
          <Button
            type="button"
            variant="destructive"
            disabled={(detail.activeAssignmentCount ?? 0) > 0}
            onClick={() => setDeleteSubscriptionOpen(true)}
          >
            Eliminar suscripción
          </Button>
          {(detail.activeAssignmentCount ?? 0) > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Quite las asignaciones activas antes de eliminar la suscripción.
            </p>
          ) : null}
        </section>
      ) : null}

      <DeleteLicenseConfirmDialog
        open={deleteSubscriptionOpen}
        onOpenChange={setDeleteSubscriptionOpen}
        title="Eliminar suscripción"
        entityLabel={detail ? `${detail.product.name} · ${detail.planName}` : ''}
        hasHistory={Boolean(detail?.hasAssignmentHistory)}
        pending={deleteSubscriptionPending}
        onConfirm={confirmDeleteSubscription}
      />
    </MainLayout>
  );
}
