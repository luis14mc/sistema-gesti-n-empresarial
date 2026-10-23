'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ExternalLink, Laptop, MoreHorizontal, User } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { assignmentKeys, useAssignmentDetail, useAssignments } from '@/hooks/useAssignments';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/platform/security/session-module-access';
import { RETURN_REASON_OPTIONS } from '@/modules/equipment/domain/acta-texts';
import type { Role } from '@/types';
import { sileo } from 'sileo';
import {
  ASSIGNMENT_STATUS_CLASSES,
  ASSIGNMENT_STATUS_LABELS,
} from '@/components/equipment/assignments/constants';
import { AssignmentEquipmentTimeline } from '@/components/equipment/assignments/AssignmentEquipmentTimeline';
import { ReturnAssignmentDialog } from '@/components/equipment/assignments/ReturnAssignmentDialog';
import { SwapAssignmentDialog } from '@/components/equipment/assignments/SwapAssignmentDialog';
import {
  actaDownloadUrl,
  assignmentsListHref,
  equipmentCategoryIcon,
  equipmentTypeLabel,
  getAssigneeInitials,
  getAssigneeName,
  getDepartmentLine,
  getEquipmentBrandModel,
  getInventoryCode,
  getSerialNumber,
  parseLegacyDeliveryNotes,
} from '@/components/equipment/assignments/utils';
import { formatDateTime } from '@/utils/helpers';
import type { EquipmentAssignment } from '@/types';

function DetailDl({
  rows,
  testId,
}: {
  rows: Array<{ label: string; value: string | null | undefined; preWrap?: boolean }>;
  testId?: string;
}) {
  return (
    <dl className="grid min-w-0 gap-4 sm:grid-cols-2" data-testid={testId}>
      {rows.map(({ label, value, preWrap }) => (
        <div key={label} className="min-w-0 break-words">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className={`mt-0.5 text-sm font-medium ${preWrap ? 'whitespace-pre-wrap' : ''}`}>
            {value?.trim() ? value : '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function deliveryFields(assignment: EquipmentAssignment) {
  const rawNotes = assignment.assignmentNotes ?? assignment.notes;
  const parsed = parseLegacyDeliveryNotes(rawNotes);
  const condition =
    parsed.condition ??
    (assignment as EquipmentAssignment & { deliveryCondition?: string | null }).deliveryCondition ??
    null;
  const accessoriesDelivered = parsed.accessories ?? assignment.accessoriesSnapshot;
  const notesDisplay =
    parsed.remainingNotes ??
    (parsed.condition || parsed.accessories ? null : rawNotes);

  return {
    condition,
    accessoriesDelivered,
    notesDisplay,
    motive: assignment.deliveryReason ?? '—',
  };
}

export function AssignmentDetailView({ assignmentId }: { assignmentId: string }) {
  const searchParams = useSearchParams();
  const listQuery = searchParams.toString();
  const backHref = assignmentsListHref(listQuery);

  const { user } = useAuth();
  const role = (user?.role ?? 'USER') as Role;
  const canCreate = canAccess(role, 'assignments', 'create');
  const canUpdate = canAccess(role, 'assignments', 'update');

  const queryClient = useQueryClient();
  const [returnOpen, setReturnOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);

  const { data, isLoading, isForbidden, isNotFound, isError } = useAssignmentDetail(assignmentId);
  const {
    returnAssignment,
    isReturning,
    swapEquipment,
    isSwapping,
    regenerateActa,
    isRegeneratingActa,
  } = useAssignments({ pageSize: 1 }, { enabled: false });

  const { assignments: swapCandidates } = useAssignments(
    { tab: 'active', pageSize: 100 },
    { enabled: swapOpen },
  );
  const [returnForm, setReturnForm] = useState<{
    returnCondition: string;
    returnReason: string;
    returnReasonOther: string;
    notes: string;
    accessoriesReturned: string;
  }>({
    returnCondition: 'BUENO',
    returnReason: RETURN_REASON_OPTIONS[0]?.value ?? '',
    returnReasonOther: '',
    notes: '',
    accessoriesReturned: '',
  });

  const assignment = data?.assignment;
  const isActive = assignment?.status === 'ACTIVE';
  const hasReturnActa = Boolean(
    assignment?.returnDocumentUrl || assignment?.returnedDate || assignment?.status === 'RETURNED',
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <p className="font-medium text-destructive">No tiene permiso para ver asignaciones de equipos.</p>
        <p className="mt-2 text-sm text-muted-foreground">Se requiere permiso de lectura de equipos.</p>
        <Button className="mt-6" variant="outline" asChild>
          <Link href={backHref}>← Volver</Link>
        </Button>
      </div>
    );
  }

  if (isNotFound || !assignment) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="font-medium">Asignación no encontrada</p>
        <p className="mt-2 text-sm text-muted-foreground">
          El registro no existe o no pertenece a su organización.
        </p>
        <Button className="mt-6" variant="outline" asChild>
          <Link href={backHref}>← Volver</Link>
        </Button>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-destructive">No se pudo cargar la asignación.</p>
        <Button className="mt-6" variant="outline" asChild>
          <Link href={backHref}>← Volver</Link>
        </Button>
      </div>
    );
  }

  const assigneeName = getAssigneeName(assignment);
  const inventoryCode = getInventoryCode(assignment);
  const delivery = deliveryFields(assignment);
  const TypeIcon = equipmentCategoryIcon(assignment.equipment?.category);
  const equipmentRows = [
    ['RAM', assignment.ramSnapshot ?? assignment.equipment?.ram],
    ['Procesador', assignment.processorSnapshot ?? assignment.equipment?.processor],
    ['Almacenamiento', assignment.storageSnapshot ?? assignment.equipment?.storage],
    ['Sistema operativo', assignment.operatingSystemSnapshot ?? assignment.equipment?.os],
    ['Accesorios', assignment.accessoriesSnapshot ?? assignment.equipment?.includedAccessories],
    ['Software instalado', assignment.softwareSnapshot ?? assignment.equipment?.installedSoftware],
    ['Licencias del equipo', null as string | null],
  ] as const;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-1 size-4" />
            Volver
          </Link>
        </Button>
      </div>

      <PageHeader
        title={inventoryCode}
        breadcrumbs={[
          { label: 'Activos', href: '/activos/equipos' },
          { label: 'Asignaciones', href: backHref },
          { label: inventoryCode },
        ]}
      />

      <Card className="min-w-0 overflow-hidden">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 gap-4">
            <Avatar className="size-14 shrink-0">
              <AvatarFallback className="text-lg">{getAssigneeInitials(assigneeName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 break-words">
              <p className="text-xl font-semibold">{assigneeName}</p>
              <p className="text-sm text-muted-foreground">{getDepartmentLine(assignment)}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-stretch gap-3 sm:items-end">
            <Badge
              variant="outline"
              className={`w-fit px-3 py-1 text-sm ${ASSIGNMENT_STATUS_CLASSES[assignment.status] ?? ''}`}
            >
              {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
            </Badge>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button variant="outline" size="sm" asChild>
                <a href={actaDownloadUrl(assignment.id, 'delivery')} target="_blank" rel="noreferrer">
                  Descargar acta de entrega
                </a>
              </Button>
              {hasReturnActa ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={actaDownloadUrl(assignment.id, 'return')} target="_blank" rel="noreferrer">
                    Descargar acta de devolución
                  </a>
                </Button>
              ) : null}
              {isActive && canCreate ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setReturnOpen(true)}>
                    Registrar devolución
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setSwapOpen(true)}>
                    Cambio de equipo
                  </Button>
                </>
              ) : null}
              {canUpdate ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="size-9" aria-label="Más acciones">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={isRegeneratingActa}
                      onSelect={() => {
                        void regenerateActa({ id: assignment.id, type: 'delivery' }).then(() =>
                          sileo.success({ title: 'Acta de entrega regenerada' }),
                        );
                      }}
                    >
                      Regenerar acta de entrega
                    </DropdownMenuItem>
                    {hasReturnActa ? (
                      <DropdownMenuItem
                        disabled={isRegeneratingActa}
                        onSelect={() => {
                          void regenerateActa({ id: assignment.id, type: 'return' }).then(() =>
                            sileo.success({ title: 'Acta de devolución regenerada' }),
                          );
                        }}
                      >
                        Regenerar acta de devolución
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Equipo entregado</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 pt-0">
              <div className="flex min-w-0 gap-3 rounded-lg border bg-muted/30 p-4">
                <TypeIcon className="mt-0.5 size-8 shrink-0 text-muted-foreground" />
                <div className="min-w-0 break-words">
                  <p className="font-semibold">{getEquipmentBrandModel(assignment)}</p>
                  <p className="text-sm text-muted-foreground">{equipmentTypeLabel(assignment)}</p>
                  <p className="mt-1 font-mono text-sm">
                    {inventoryCode}
                    <span className="mx-2 text-muted-foreground">·</span>
                    {getSerialNumber(assignment)}
                  </p>
                </div>
              </div>
              <DetailDl
                testId="assignment-detail-snapshots"
                rows={equipmentRows.map(([label, value]) => ({ label, value }))}
              />
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden" data-testid="assignment-delivery-section">
            <CardHeader>
              <CardTitle className="text-base">Entrega</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 pt-0">
              <DetailDl
                rows={[
                  { label: 'Fecha y hora', value: formatDateTime(assignment.assignedDate) },
                  { label: 'Motivo', value: delivery.motive === '—' ? null : delivery.motive },
                  { label: 'Entregado por', value: null },
                  { label: 'Condición', value: delivery.condition },
                  { label: 'Accesorios entregados', value: delivery.accessoriesDelivered, preWrap: true },
                  { label: 'Notas', value: delivery.notesDisplay, preWrap: true },
                ]}
              />
            </CardContent>
          </Card>

          {assignment.returnedDate ? (
            <Card className="min-w-0 overflow-hidden" data-testid="assignment-return-section">
              <CardHeader>
                <CardTitle className="text-base">Devolución</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 pt-0">
                <DetailDl
                  rows={[
                    { label: 'Fecha', value: formatDateTime(assignment.returnedDate) },
                    { label: 'Motivo', value: assignment.returnReason },
                    { label: 'Recibido por', value: null },
                    { label: 'Estado al recibir', value: assignment.returnCondition },
                    { label: 'Observaciones', value: assignment.returnNotes, preWrap: true },
                  ]}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-1">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Línea de tiempo del equipo</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 pt-0">
              {data ? (
                <AssignmentEquipmentTimeline
                  timeline={data.equipmentTimeline}
                  currentAssignmentId={assignment.id}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Accesos rápidos</CardTitle>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-2 pt-0">
              {assignment.equipmentId ? (
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/activos/equipos?equipmentId=${assignment.equipmentId}`}>
                    <Laptop className="mr-2 size-4" />
                    Ver ficha del equipo
                    <ExternalLink className="ml-auto size-3.5 opacity-50" />
                  </Link>
                </Button>
              ) : null}
              {assignment.employeeId ? (
                <Button variant="outline" className="justify-start" asChild>
                  <Link href={`/activos/por-empleado?employee=${assignment.employeeId}`}>
                    <User className="mr-2 size-4" />
                    Ver activos del empleado
                    <ExternalLink className="ml-auto size-3.5 opacity-50" />
                  </Link>
                </Button>
              ) : null}
              {!assignment.equipmentId && !assignment.employeeId ? (
                <p className="text-sm text-muted-foreground">Sin enlaces disponibles.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <ReturnAssignmentDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        assignment={assignment}
        form={returnForm}
        onFormChange={(patch) => setReturnForm((prev) => ({ ...prev, ...patch }))}
        isSubmitting={isReturning}
        onSubmit={(payload) => {
          returnAssignment(
            { id: assignment.id, data: payload },
            {
              onSuccess: () => {
                setReturnOpen(false);
                void queryClient.invalidateQueries({ queryKey: assignmentKeys.detail(assignment.id) });
                sileo.success({
                  title: 'Devolución registrada',
                  description: 'Puede descargar el acta de devolución.',
                });
                window.open(actaDownloadUrl(assignment.id, 'return'), '_blank', 'noopener,noreferrer');
              },
              onError: () => sileo.error({ title: 'No se pudo registrar la devolución' }),
            },
          );
        }}
      />

      <SwapAssignmentDialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        activeAssignments={swapCandidates}
        initialAssignmentId={assignment.id}
        isSubmitting={isSwapping}
        onSubmit={async (payload) => {
          try {
            await swapEquipment(payload);
            sileo.success({ title: 'Cambio de equipo registrado' });
            setSwapOpen(false);
          } catch {
            sileo.error({ title: 'No se pudo realizar el cambio' });
          }
        }}
      />
    </div>
  );
}
