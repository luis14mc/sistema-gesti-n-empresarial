'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAssignments } from '@/hooks/useAssignments';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/platform/security/session-module-access';
import { sileo } from 'sileo';
import { downloadReportExport } from '@/services/reports.service';
import type { EquipmentAssignment, Role } from '@/types';
import { RETURN_REASON_OPTIONS } from '@/modules/equipment/domain/acta-texts';
import { AssignmentsKpiCards } from '@/components/equipment/assignments/AssignmentsKpiCards';
import { AssignmentsFiltersBar } from '@/components/equipment/assignments/AssignmentsFiltersBar';
import { AssignmentsTable } from '@/components/equipment/assignments/AssignmentsTable';
import { AssignmentsMobileList } from '@/components/equipment/assignments/AssignmentsMobileList';
import { NewAssignmentDialog } from '@/components/equipment/assignments/NewAssignmentDialog';
import { ReturnAssignmentDialog } from '@/components/equipment/assignments/ReturnAssignmentDialog';
import { SwapAssignmentDialog } from '@/components/equipment/assignments/SwapAssignmentDialog';
import { useAssignmentsUrlState } from '@/components/equipment/assignments/use-assignments-url-state';
import { actaDownloadUrl } from '@/components/equipment/assignments/utils';
import type { AssignmentsTab } from '@/components/equipment/assignments/constants';

function AssignmentsViewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const role = (user?.role ?? 'USER') as Role;
  const canCreate = canAccess(role, 'assignments', 'create');
  const canUpdate = canAccess(role, 'assignments', 'update');

  const { state, patchParams, filtersForApi } = useAssignmentsUrlState();
  const {
    assignments,
    summary,
    total,
    page,
    totalPages,
    isLoading,
    isForbidden,
    isError,
    createAssignment,
    isCreating,
    returnAssignment,
    isReturning,
    swapEquipment,
    isSwapping,
    regenerateActa,
    isRegeneratingActa,
  } = useAssignments(filtersForApi);

  const [newOpen, setNewOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapSeedId, setSwapSeedId] = useState<string | undefined>();
  const [returningAssignment, setReturningAssignment] = useState<EquipmentAssignment | null>(null);
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
  const [exporting, setExporting] = useState(false);

  const { assignments: swapCandidates } = useAssignments(
    { tab: 'active', pageSize: 100 },
    { enabled: swapOpen },
  );

  const showReturnedColumn = state.tab !== 'active';

  const openAssignmentDetail = (assignmentId: string) => {
    const query = searchParams.toString();
    router.push(`/activos/asignaciones/${assignmentId}${query ? `?${query}` : ''}`);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const to = new Date();
      const from = new Date(to);
      from.setFullYear(from.getFullYear() - 1);
      const { blob, filename } = await downloadReportExport('EQUIPMENT_ASSIGNMENT_HISTORY', {
        format: 'xlsx',
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      sileo.error({ title: 'No se pudo exportar el historial' });
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (column: typeof state.sortBy) => {
    if (state.sortBy === column) {
      patchParams({ sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      patchParams({ sortBy: column, sortDir: 'desc' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asignaciones de equipos"
        description="Entrega, devolución y trazabilidad de activos"
        primaryAction={
          canCreate ? (
            <Button type="button" onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 size-4" />
              Nueva asignación
            </Button>
          ) : undefined
        }
        secondaryActions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setSwapOpen(true)}>
                <ArrowLeftRight className="mr-2 size-4" />
                Cambio de equipo
              </Button>
              <Button type="button" variant="outline" disabled={exporting} onClick={() => void handleExport()}>
                {exporting ? 'Exportando…' : 'Exportar Excel'}
              </Button>
            </div>
          ) : undefined
        }
      />

      <AssignmentsKpiCards summary={summary} />

      <Tabs
        value={state.tab}
        onValueChange={(value) => patchParams({ tab: value as AssignmentsTab }, true)}
      >
        <TabsList>
          <TabsTrigger value="active">Activas</TabsTrigger>
          <TabsTrigger value="history">Historial (devueltas)</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      <AssignmentsFiltersBar
        value={{
          search: state.search,
          departmentId: state.departmentId,
          equipmentCategory: state.equipmentCategory,
          assignedFrom: state.assignedFrom,
          assignedTo: state.assignedTo,
        }}
        onChange={(patch) =>
          patchParams(
            {
              search: patch.search,
              departmentId: patch.departmentId,
              equipmentCategory: patch.equipmentCategory,
              assignedFrom: patch.assignedFrom,
              assignedTo: patch.assignedTo,
            },
            true,
          )
        }
        onClear={() =>
          patchParams({
            search: null,
            departmentId: null,
            equipmentCategory: null,
            assignedFrom: null,
            assignedTo: null,
            page: '1',
          })
        }
      />

      {isForbidden ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No tiene permiso para ver asignaciones de equipos.
        </p>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">No se pudieron cargar las asignaciones.</p>
      ) : assignments.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-muted-foreground">No hay asignaciones con estos filtros.</p>
          {canCreate ? (
            <Button className="mt-4" type="button" onClick={() => setNewOpen(true)}>
              Nueva asignación
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <AssignmentsTable
            items={assignments}
            showReturnedColumn={showReturnedColumn}
            sortBy={state.sortBy}
            sortDir={state.sortDir}
            onSort={handleSort}
            onRowClick={(row) => openAssignmentDetail(row.id)}
            canCreate={canCreate}
            canUpdate={canUpdate}
            onReturn={(row) => {
              setReturningAssignment(row);
              setReturnForm({
                returnCondition: 'BUENO',
                returnReason: RETURN_REASON_OPTIONS[0]?.value ?? '',
                returnReasonOther: '',
                notes: '',
                accessoriesReturned: '',
              });
              setReturnOpen(true);
            }}
            onSwap={(row) => {
              setSwapSeedId(row.id);
              setSwapOpen(true);
            }}
            onRegenerateActa={async (row, type) => {
              try {
                await regenerateActa({ id: row.id, type });
                sileo.success({ title: 'Acta regenerada' });
              } catch {
                sileo.error({ title: 'No se pudo regenerar el acta' });
              }
            }}
            regenerating={isRegeneratingActa}
          />
          <AssignmentsMobileList
            items={assignments}
            canCreate={canCreate}
            canUpdate={canUpdate}
            onRowClick={(row) => openAssignmentDetail(row.id)}
            onReturn={(row) => {
              setReturningAssignment(row);
              setReturnOpen(true);
            }}
            onSwap={(row) => {
              setSwapSeedId(row.id);
              setSwapOpen(true);
            }}
            onRegenerateActa={async (row, type) => {
              try {
                await regenerateActa({ id: row.id, type });
                sileo.success({ title: 'Acta regenerada' });
              } catch {
                sileo.error({ title: 'No se pudo regenerar el acta' });
              }
            }}
            regenerating={isRegeneratingActa}
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              {total} registro(s) · página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => patchParams({ page: String(page - 1) })}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => patchParams({ page: String(page + 1) })}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      <NewAssignmentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        isSubmitting={isCreating}
        onSubmit={(data) => {
          createAssignment(data, {
            onSuccess: (assignment) => {
              setNewOpen(false);
              sileo.success({
                title: 'Asignación creada',
                description: 'Puede descargar el acta de entrega ahora.',
              });
              if (assignment?.id) {
                window.open(actaDownloadUrl(assignment.id, 'delivery'), '_blank', 'noopener,noreferrer');
              }
            },
            onError: () => sileo.error({ title: 'No se pudo crear la asignación' }),
          });
        }}
      />

      <ReturnAssignmentDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        assignment={returningAssignment}
        form={returnForm}
        onFormChange={(patch) => setReturnForm((prev) => ({ ...prev, ...patch }))}
        isSubmitting={isReturning}
        onSubmit={(data) => {
          if (!returningAssignment) return;
          returnAssignment(
            { id: returningAssignment.id, data },
            {
              onSuccess: () => {
                setReturnOpen(false);
                const id = returningAssignment.id;
                setReturningAssignment(null);
                sileo.success({
                  title: 'Devolución registrada',
                  description: 'Puede descargar el acta de devolución.',
                });
                window.open(actaDownloadUrl(id, 'return'), '_blank', 'noopener,noreferrer');
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
        initialAssignmentId={swapSeedId}
        isSubmitting={isSwapping}
        onSubmit={async (data) => {
          try {
            await swapEquipment(data);
            sileo.success({ title: 'Cambio de equipo registrado' });
            setSwapOpen(false);
            setSwapSeedId(undefined);
          } catch {
            sileo.error({ title: 'No se pudo realizar el cambio' });
          }
        }}
      />
    </div>
  );
}

export function AssignmentsView() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <AssignmentsViewInner />
    </Suspense>
  );
}
