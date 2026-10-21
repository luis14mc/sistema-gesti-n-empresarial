'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/utils/api';
import { moneyLabel, STATUS_LABEL } from '@/components/software-licenses/labels';
import { formatPaymentSchedule } from '@/modules/software-licenses/domain/billing';

type Assignment = { id: string; unassignedAt: string | null; employee: { id: string; fullName: string; isActive: boolean } };
type Seat = {
  id: string;
  accountEmail: string | null;
  seatType: 'INDIVIDUAL' | 'SHARED';
  effectiveStatus: string;
  status: string;
  assignments: Assignment[];
};
type Detail = {
  id: string;
  planName: string;
  currency: string;
  monthlyCost: number;
  displayStatus: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  billingCycle: 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'OTHER';
  paymentDay: number | null;
  renewalDate: string | null;
  product: { name: string };
  counts: { contractedSeats: number; occupiedSeats: number; availableSeats: number };
  seats: Seat[];
};

export default function SoftwareLicenseDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string }>>([]);
  const [error, setError] = useState('');
  const [newSeatEmail, setNewSeatEmail] = useState('');
  const [seatEmailDraft, setSeatEmailDraft] = useState<Record<string, string>>({});

  async function reload() {
    const response = await api.get(`/api/software-licenses/${params.id}`);
    const data = response.data.data as Detail;
    setDetail(data);
    setSeatEmailDraft((prev) => {
      const next = { ...prev };
      for (const seat of data.seats) {
        if (next[seat.id] === undefined) next[seat.id] = seat.accountEmail ?? '';
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/software-licenses/${params.id}`)
      .then((response) => {
        if (cancelled) return;
        const data = response.data.data as Detail;
        setDetail(data);
        setSeatEmailDraft(Object.fromEntries(data.seats.map((seat) => [seat.id, seat.accountEmail ?? ''])));
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo abrir la suscripción.');
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (employeeQuery.trim().length < 2) return undefined;
    let cancelled = false;
    api
      .get('/api/employees', { params: { search: employeeQuery, isActive: true, pageSize: 8 } })
      .then((response) => {
        if (!cancelled) setEmployees(response.data.employees ?? response.data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeQuery]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await reload();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      setError(message ?? 'La operación no se completó.');
    }
  }

  const liveSeatCount = detail?.seats.filter((seat) => seat.status !== 'CANCELLED').length ?? 0;
  const canAddSeat = detail ? liveSeatCount < detail.counts.contractedSeats : false;

  return (
    <MainLayout>
      <PageHeader
        title={detail?.product.name ?? 'Licencia'}
        description={
          detail
            ? `${detail.planName} · ${detail.counts.occupiedSeats} ocupados · ${detail.counts.availableSeats} disponibles · ${moneyLabel(detail.currency, detail.monthlyCost)} / mes`
            : 'Cargando'
        }
        breadcrumbs={[
          { label: 'Activos', href: '/equipment' },
          { label: 'Licencias', href: '/ti/licencias' },
          { label: detail?.product.name ?? 'Detalle' },
        ]}
        primaryAction={
          detail ? (
            <Button asChild>
              <Link href={`/ti/licencias/${detail.id}/editar`}>Editar suscripción</Link>
            </Button>
          ) : undefined
        }
        secondaryActions={
          detail ? (
            <div className="flex flex-wrap gap-2">
              {detail.status === 'ACTIVE' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    run(() => api.patch(`/api/software-licenses/${detail.id}`, { status: 'SUSPENDED' }))
                  }
                >
                  Suspender
                </Button>
              ) : null}
              {detail.status === 'SUSPENDED' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => run(() => api.patch(`/api/software-licenses/${detail.id}`, { status: 'ACTIVE' }))}
                >
                  Reactivar
                </Button>
              ) : null}
              {detail.status !== 'CANCELLED' ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (
                      !window.confirm(
                        '¿Cancelar esta suscripción? Los asientos dejarán de contarse como activos. Puedes editarla después si necesitas corregir datos.',
                      )
                    ) {
                      return;
                    }
                    void run(() => api.patch(`/api/software-licenses/${detail.id}`, { status: 'CANCELLED' }));
                  }}
                >
                  Cancelar suscripción
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {detail ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Próximo pago: {formatPaymentSchedule(detail)} · {STATUS_LABEL[detail.displayStatus] ?? detail.displayStatus}
          {detail.status !== detail.displayStatus ? ` · Estado: ${STATUS_LABEL[detail.status] ?? detail.status}` : null}
        </p>
      ) : null}

      {canAddSeat ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="font-medium">Agregar asiento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {liveSeatCount} de {detail?.counts.contractedSeats} asientos registrados. Puedes crear otro asiento disponible.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="new-seat-email">Correo de la cuenta (opcional)</Label>
              <Input
                id="new-seat-email"
                type="email"
                value={newSeatEmail}
                onChange={(event) => setNewSeatEmail(event.target.value)}
                placeholder="usuario@empresa.com"
              />
            </div>
            <Button
              type="button"
              onClick={() =>
                run(async () => {
                  await api.post(`/api/software-licenses/${params.id}/seats`, {
                    accountEmail: newSeatEmail.trim() || null,
                    seatType: 'INDIVIDUAL',
                  });
                  setNewSeatEmail('');
                })
              }
            >
              Crear asiento
            </Button>
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-3">
        {detail?.seats
          .filter((seat) => seat.status !== 'CANCELLED')
          .map((seat) => {
            const active = seat.assignments.filter((assignment) => !assignment.unassignedAt);
            const history = seat.assignments.filter((assignment) => assignment.unassignedAt);
            const emailDraft = seatEmailDraft[seat.id] ?? seat.accountEmail ?? '';
            const emailDirty = emailDraft !== (seat.accountEmail ?? '');
            return (
              <article key={seat.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`seat-email-${seat.id}`} className="sr-only">
                        Correo del asiento
                      </Label>
                      <Input
                        id={`seat-email-${seat.id}`}
                        className="max-w-md"
                        value={emailDraft}
                        onChange={(event) =>
                          setSeatEmailDraft((prev) => ({ ...prev, [seat.id]: event.target.value }))
                        }
                        placeholder="Correo de la cuenta"
                      />
                      {emailDirty ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          onClick={() =>
                            run(() =>
                              api.patch(`/api/software-licenses/seats/${seat.id}`, {
                                accountEmail: emailDraft.trim() || null,
                              }),
                            )
                          }
                        >
                          Guardar correo
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {STATUS_LABEL[seat.seatType]} · {STATUS_LABEL[seat.effectiveStatus] ?? seat.effectiveStatus}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {seat.seatType === 'INDIVIDUAL' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(() => api.patch(`/api/software-licenses/seats/${seat.id}`, { seatType: 'SHARED' }))}
                      >
                        Compartir
                      </Button>
                    ) : null}
                    {seat.seatType === 'SHARED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(() => api.patch(`/api/software-licenses/seats/${seat.id}`, { seatType: 'INDIVIDUAL' }))}
                      >
                        Individual
                      </Button>
                    ) : null}
                    {seat.effectiveStatus !== 'SUSPENDED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(() => api.patch(`/api/software-licenses/seats/${seat.id}`, { status: 'SUSPENDED' }))}
                      >
                        Suspender
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(() => api.patch(`/api/software-licenses/seats/${seat.id}`, { status: 'AVAILABLE' }))}
                      >
                        Reactivar
                      </Button>
                    )}
                  </div>
                </div>
                <ul className="mt-3 space-y-2">
                  {active.map((assignment) => (
                    <li key={assignment.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        {assignment.employee.fullName}
                        {assignment.employee.isActive ? '' : ' · inactivo'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => run(() => api.post(`/api/software-licenses/assignments/${assignment.id}/unassign`))}
                      >
                        Quitar
                      </Button>
                    </li>
                  ))}
                  {active.length === 0 ? <li className="text-sm text-muted-foreground">Sin asignación activa</li> : null}
                </ul>
                {history.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Historial: {history.map((assignment) => assignment.employee.fullName).join(', ')}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={employeeQuery}
                    onChange={(event) => setEmployeeQuery(event.target.value)}
                    placeholder="Buscar empleado activo"
                    aria-label={`Asignar empleado a ${seat.accountEmail ?? 'asiento disponible'}`}
                  />
                  <div className="flex flex-wrap gap-2">
                    {employees.map((employee) => (
                      <Button
                        key={employee.id}
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          run(() =>
                            api.post(`/api/software-licenses/seats/${seat.id}/assignments`, { employeeId: employee.id }),
                          )
                        }
                      >
                        {employee.fullName}
                      </Button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
      </div>
      {detail ? (
        <Badge className="mt-4" variant="outline">
          {detail.counts.contractedSeats} contratados · {liveSeatCount} registrados
        </Badge>
      ) : null}
    </MainLayout>
  );
}
