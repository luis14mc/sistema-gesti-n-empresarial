'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { api } from '@/utils/api';
import { STATUS_LABEL } from '@/components/software-licenses/labels';

type Row = {
  subscriptionId: string;
  software: string;
  email: string | null;
  seatType: string;
  status: string;
  employee: string;
  active: boolean;
};

export default function LicenseAssignmentsPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    api.get(`/api/software-licenses?${params.toString()}`).then((response) => {
      const next: Row[] = [];
      for (const subscription of response.data.data.items) {
        for (const seat of subscription.seats) {
          const assignments = seat.assignments.length > 0 ? seat.assignments : [null];
          for (const assignment of assignments) {
            next.push({
              subscriptionId: subscription.id,
              software: subscription.product.name,
              email: seat.accountEmail,
              seatType: seat.seatType,
              status: seat.effectiveStatus,
              employee: assignment?.employee.fullName ?? 'Disponible',
              active: assignment ? !assignment.unassignedAt : false,
            });
          }
        }
      }
      setRows(next);
    }).catch(() => setRows([]));
  }, [search]);

  return (
    <MainLayout>
      <PageHeader title="Asignaciones de licencias" description="Personas del catálogo de empleados vinculadas a cada asiento." breadcrumbs={[{ label: 'Activos', href: '/equipment' }, { label: 'Licencias', href: '/equipment/licencias' }, { label: 'Asignaciones' }]} />
      <Input className="mt-6" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Empleado, software o correo" aria-label="Buscar asignaciones" />
      <div className="mt-4 grid gap-3">
        {rows.map((row, index) => (
          <Link key={`${row.subscriptionId}-${row.email}-${row.employee}-${index}`} href={`/equipment/licencias/${row.subscriptionId}`} className="rounded-lg border p-4">
            <p className="font-medium">{row.employee}</p>
            <p className="text-sm text-muted-foreground">{row.software} · {row.email ?? 'Sin cuenta'} · {STATUS_LABEL[row.seatType]} · {STATUS_LABEL[row.status] ?? row.status}{row.active ? '' : row.employee === 'Disponible' ? '' : ' · historial'}</p>
          </Link>
        ))}
      </div>
    </MainLayout>
  );
}
