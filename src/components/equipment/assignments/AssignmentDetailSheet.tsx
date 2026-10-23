'use client';

import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssignmentDetail } from '@/hooks/useAssignments';
import {
  ASSIGNMENT_STATUS_CLASSES,
  ASSIGNMENT_STATUS_LABELS,
} from '@/components/equipment/assignments/constants';
import {
  actaDownloadUrl,
  getAssigneeName,
  getDepartmentLine,
  getEquipmentBrandModel,
  getInventoryCode,
} from '@/components/equipment/assignments/utils';
import { formatDate, formatDateTime } from '@/utils/helpers';
import type { EquipmentAssignment } from '@/types';

function SnapshotGrid({ assignment }: { assignment: EquipmentAssignment }) {
  const rows = [
    ['RAM', assignment.ramSnapshot ?? assignment.equipment?.ram],
    ['Procesador', assignment.processorSnapshot ?? assignment.equipment?.processor],
    ['Almacenamiento', assignment.storageSnapshot ?? assignment.equipment?.storage],
    ['Sistema operativo', assignment.operatingSystemSnapshot ?? assignment.equipment?.os],
    ['Accesorios', assignment.accessoriesSnapshot ?? assignment.equipment?.includedAccessories],
    ['Software', assignment.softwareSnapshot ?? assignment.equipment?.installedSoftware],
  ] as const;

  return (
    <dl className="grid gap-2 sm:grid-cols-2" data-testid="assignment-detail-snapshots">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border p-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm whitespace-pre-wrap">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AssignmentDetailSheet({
  assignmentId,
  open,
  onOpenChange,
}: {
  assignmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError } = useAssignmentDetail(open ? assignmentId : null);
  const assignment = data?.assignment;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detalle de asignación</SheetTitle>
        </SheetHeader>
        {isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError || !assignment ? (
          <p className="mt-6 text-sm text-destructive">No se pudo cargar el detalle.</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div>
              <p className="font-medium">{getAssigneeName(assignment)}</p>
              <p className="text-sm text-muted-foreground">{getDepartmentLine(assignment)}</p>
              <p className="mt-2 text-sm">
                {getEquipmentBrandModel(assignment)} ·{' '}
                <span className="font-mono text-xs">{getInventoryCode(assignment)}</span>
              </p>
              <Badge variant="outline" className={`mt-2 ${ASSIGNMENT_STATUS_CLASSES[assignment.status]}`}>
                {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
              </Badge>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Equipo entregado</h3>
              <SnapshotGrid assignment={assignment} />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Entrega</h3>
              <ul className="space-y-1 text-sm">
                <li>Fecha: {formatDateTime(assignment.assignedDate)}</li>
                <li>Motivo: {assignment.deliveryReason ?? '—'}</li>
                <li>Notas: {assignment.assignmentNotes ?? assignment.notes ?? '—'}</li>
              </ul>
              <Button className="mt-2" variant="outline" size="sm" asChild>
                <a href={actaDownloadUrl(assignment.id, 'delivery')} target="_blank" rel="noreferrer">
                  Descargar acta
                </a>
              </Button>
            </section>

            {assignment.returnedDate ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Devolución</h3>
                <ul className="space-y-1 text-sm">
                  <li>Fecha: {formatDateTime(assignment.returnedDate)}</li>
                  <li>Motivo: {assignment.returnReason ?? '—'}</li>
                  <li>Estado al recibir: {assignment.returnCondition ?? '—'}</li>
                  <li>Observaciones: {assignment.returnNotes ?? '—'}</li>
                </ul>
                <Button className="mt-2" variant="outline" size="sm" asChild>
                  <a href={actaDownloadUrl(assignment.id, 'return')} target="_blank" rel="noreferrer">
                    Descargar acta
                  </a>
                </Button>
              </section>
            ) : null}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Línea de tiempo del equipo</h3>
              <ul className="space-y-2 text-sm">
                {data?.equipmentTimeline.assignments.map((row) => (
                  <li key={row.id} className="rounded border p-2">
                    {getAssigneeName(row)} · {ASSIGNMENT_STATUS_LABELS[row.status] ?? row.status} ·{' '}
                    {formatDate(row.assignedDate)}
                  </li>
                ))}
                {data?.equipmentTimeline.maintenances.map((m) => (
                  <li key={m.id} className="rounded border p-2 text-muted-foreground">
                    Mantenimiento · {m.description} · {m.scheduledDate ? formatDate(m.scheduledDate) : '—'}
                  </li>
                ))}
                {data?.equipmentTimeline.history.map((h) => (
                  <li key={h.id} className="rounded border p-2 text-muted-foreground">
                    {h.title} · {formatDateTime(h.createdAt)}
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex flex-wrap gap-2">
              {assignment.equipmentId ? (
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={`/activos/equipos?equipmentId=${assignment.equipmentId}`}>Ver ficha del equipo</Link>
                </Button>
              ) : null}
              {assignment.employeeId ? (
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={`/activos/por-empleado?employee=${assignment.employeeId}`}>
                    Ver activos del empleado
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
