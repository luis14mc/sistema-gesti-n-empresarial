'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/utils/api';
import { moneyLabel, STATUS_LABEL } from '@/components/software-licenses/labels';
import { formatPaymentSchedule } from '@/lib/software-licenses/billing';

type Assignment = { id: string; unassignedAt: string | null; employee: { id: string; fullName: string; isActive: boolean } };
type Seat = {
  id: string;
  accountEmail: string | null;
  seatType: 'INDIVIDUAL' | 'SHARED';
  effectiveStatus: string;
  assignments: Assignment[];
};
type Detail = {
  id: string;
  planName: string;
  currency: string;
  monthlyCost: number;
  displayStatus: string;
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

  async function reload() {
    const response = await api.get(`/api/software-licenses/${params.id}`);
    setDetail(response.data.data);
  }

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/software-licenses/${params.id}`).then((response) => {
      if (!cancelled) setDetail(response.data.data);
    }).catch(() => {
      if (!cancelled) setError('No se pudo abrir la suscripción.');
    });
    return () => { cancelled = true; };
  }, [params.id]);

  useEffect(() => {
    if (employeeQuery.trim().length < 2) return undefined;
    let cancelled = false;
    api.get('/api/employees', { params: { search: employeeQuery, isActive: true, pageSize: 8 } })
      .then((response) => {
        if (!cancelled) setEmployees(response.data.employees ?? response.data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      });
    return () => { cancelled = true; };
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

  return (
    <MainLayout>
      <PageHeader
        title={detail?.product.name ?? 'Licencia'}
        description={detail ? `${detail.planName} · ${detail.counts.occupiedSeats} ocupados · ${detail.counts.availableSeats} disponibles · ${moneyLabel(detail.currency, detail.monthlyCost)} / mes` : 'Cargando'}
        breadcrumbs={[{ label: 'Licencias', href: '/ti/licencias' }, { label: detail?.product.name ?? 'Detalle' }]}
      />
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {detail ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Próximo pago: {formatPaymentSchedule(detail)} · {STATUS_LABEL[detail.displayStatus] ?? detail.displayStatus}
        </p>
      ) : null}
      <div className="mt-6 grid gap-3">
        {detail?.seats.map((seat) => {
          const active = seat.assignments.filter((assignment) => !assignment.unassignedAt);
          const history = seat.assignments.filter((assignment) => assignment.unassignedAt);
          return (
            <article key={seat.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{seat.accountEmail ?? 'Sin cuenta'}</p>
                  <p className="text-sm text-muted-foreground">{STATUS_LABEL[seat.seatType]} · {STATUS_LABEL[seat.effectiveStatus] ?? seat.effectiveStatus}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {seat.seatType === 'INDIVIDUAL' ? <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`/api/software-licenses/seats/${seat.id}`, { seatType: 'SHARED' }))}>Compartir</Button> : null}
                  {seat.seatType === 'SHARED' ? <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`/api/software-licenses/seats/${seat.id}`, { seatType: 'INDIVIDUAL' }))}>Individual</Button> : null}
                  {seat.effectiveStatus !== 'SUSPENDED' ? <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`/api/software-licenses/seats/${seat.id}`, { status: 'SUSPENDED' }))}>Suspender</Button> : <Button size="sm" variant="outline" onClick={() => run(() => api.patch(`/api/software-licenses/seats/${seat.id}`, { status: 'AVAILABLE' }))}>Reactivar</Button>}
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {active.map((assignment) => (
                  <li key={assignment.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{assignment.employee.fullName}{assignment.employee.isActive ? '' : ' · inactivo'}</span>
                    <Button size="sm" variant="ghost" onClick={() => run(() => api.post(`/api/software-licenses/assignments/${assignment.id}/unassign`))}>Quitar</Button>
                  </li>
                ))}
                {active.length === 0 ? <li className="text-sm text-muted-foreground">Sin asignación activa</li> : null}
              </ul>
              {history.length > 0 ? <p className="mt-2 text-xs text-muted-foreground">Historial: {history.map((assignment) => assignment.employee.fullName).join(', ')}</p> : null}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Buscar empleado activo" aria-label={`Asignar empleado a ${seat.accountEmail ?? 'asiento disponible'}`} />
                <div className="flex flex-wrap gap-2">
                  {employees.map((employee) => (
                    <Button key={employee.id} size="sm" variant="secondary" onClick={() => run(() => api.post(`/api/software-licenses/seats/${seat.id}/assignments`, { employeeId: employee.id }))}>
                      {employee.fullName}
                    </Button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {detail ? <Badge className="mt-4" variant="outline">{detail.counts.contractedSeats} contratados</Badge> : null}
    </MainLayout>
  );
}
