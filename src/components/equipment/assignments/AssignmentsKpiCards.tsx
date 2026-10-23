'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { AssignmentsListSummary } from '@/services/equipment-assignments.service';

const KPI_ITEMS = [
  ['activeCount', 'Asignaciones activas'],
  ['returnsThisMonth', 'Devoluciones este mes'],
  ['availableEquipmentCount', 'Equipos disponibles para asignar'],
  ['employeesWithMultipleActive', 'Empleados con más de 1 equipo'],
] as const;

export function AssignmentsKpiCards({ summary }: { summary?: AssignmentsListSummary }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {KPI_ITEMS.map(([key, label]) => (
        <Card key={key}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary ? summary[key] : '—'}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
