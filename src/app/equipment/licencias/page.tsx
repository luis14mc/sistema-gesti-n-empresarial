'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/utils/api';
import { moneyLabel, STATUS_LABEL } from '@/components/software-licenses/labels';

type Dashboard = {
  activeProducts: number;
  contractedSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  assignedUsers: number;
  sharedAccounts: number;
  costs: Record<string, { monthlyCost: number; annualCost: number }>;
  upcomingRenewals: number;
  expiredOrSuspended: number;
};

type Subscription = {
  id: string;
  planName: string;
  currency: string;
  monthlyCost: number;
  displayStatus: string;
  renewalDate: string | null;
  paymentDay: number | null;
  product: { name: string; vendor: string | null };
  counts: { contractedSeats: number; occupiedSeats: number; availableSeats: number };
};

const KPI = [
  ['activeProducts', 'Productos activos'],
  ['contractedSeats', 'Asientos contratados'],
  ['occupiedSeats', 'Asientos ocupados'],
  ['availableSeats', 'Asientos disponibles'],
  ['assignedUsers', 'Usuarios asignados'],
  ['sharedAccounts', 'Cuentas compartidas'],
  ['upcomingRenewals', 'Renovaciones próximas'],
  ['expiredOrSuspended', 'Vencidas o suspendidas'],
] as const;

export default function SoftwareLicensesPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [items, setItems] = useState<Subscription[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [seatType, setSeatType] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (seatType) params.set('seatType', seatType);
    let cancelled = false;
    Promise.all([
      api.get('/api/software-licenses/dashboard'),
      api.get(`/api/software-licenses?${params.toString()}`),
    ]).then(([summary, list]) => {
      if (cancelled) return;
      setDashboard(summary.data.data);
      setItems(list.data.data.items);
    }).catch(() => {
      if (!cancelled) setError('No se pudieron cargar las licencias.');
    });
    return () => { cancelled = true; };
  }, [search, status, seatType, refresh]);

  return (
    <MainLayout>
      <PageHeader
        title="Licencias de software"
        description="Asientos contratados, cuentas compartidas y renovaciones."
        breadcrumbs={[{ label: 'Activos', href: '/equipment' }, { label: 'Licencias' }]}
        primaryAction={<Button asChild><Link href="/equipment/licencias/nueva">Registrar licencia</Link></Button>}
        secondaryActions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" type="button" onClick={() => { window.location.assign('/api/software-licenses/export'); }}>Exportar</Button>
            <Button variant="outline" asChild><Link href="/equipment/licencias/asignaciones">Asignaciones</Link></Button>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm">
              Importar
              <input className="sr-only" type="file" accept=".xlsx" aria-label="Importar Excel de licencias" onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                const body = new FormData();
                body.set('file', file);
                try {
                  const response = await api.post('/api/software-licenses/import', body);
                  const report = response.data.data;
                  setNotice(`Importados ${report.products} productos, ${report.seats} asientos, ${report.assignments} asignaciones. Sin empleado: ${report.unmatchedEmployees.length}.`);
                  setRefresh((value) => value + 1);
                } catch {
                  setError('No se pudo importar el archivo.');
                }
              }} />
            </label>
          </div>
        )}
      />
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-muted-foreground">{notice}</p> : null}
      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPI.map(([key, label]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{dashboard ? dashboard[key] : '—'}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Costo mensual / anual equivalente</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {dashboard
                ? Object.entries(dashboard.costs).map(([currency, cost]) => `${moneyLabel(currency, cost.monthlyCost)} / mes · ${moneyLabel(currency, cost.annualCost)} / año`).join(' · ') || '—'
                : '—'}
            </p>
          </CardContent>
        </Card>
      </section>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Software, empleado o correo" aria-label="Buscar licencias" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={seatType} onChange={(event) => setSeatType(event.target.value)} aria-label="Tipo de asiento">
          <option value="">Todos los asientos</option>
          <option value="INDIVIDUAL">Individual</option>
          <option value="SHARED">Compartida</option>
        </select>
      </div>
      <div className="mt-4 grid gap-3 md:hidden">
        {items.map((item) => (
          <Link key={item.id} href={`/equipment/licencias/${item.id}`} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">{item.planName}</p>
              </div>
              <Badge variant="outline">{STATUS_LABEL[item.displayStatus] ?? item.displayStatus}</Badge>
            </div>
            <p className="mt-3 text-sm">{item.counts.occupiedSeats}/{item.counts.contractedSeats} ocupados · {moneyLabel(item.currency, item.monthlyCost)} / mes</p>
          </Link>
        ))}
      </div>
      <div className="mt-4 hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3 font-medium">Software</th>
              <th className="p-3 font-medium">Plan</th>
              <th className="p-3 font-medium">Asientos</th>
              <th className="p-3 font-medium">Costo mensual</th>
              <th className="p-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="p-3"><Link className="font-medium underline-offset-4 hover:underline" href={`/equipment/licencias/${item.id}`}>{item.product.name}</Link></td>
                <td className="p-3">{item.planName}</td>
                <td className="p-3 tabular-nums">{item.counts.occupiedSeats} ocupados · {item.counts.availableSeats} disponibles</td>
                <td className="p-3 tabular-nums">{moneyLabel(item.currency, item.monthlyCost)}</td>
                <td className="p-3">{STATUS_LABEL[item.displayStatus] ?? item.displayStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MainLayout>
  );
}
