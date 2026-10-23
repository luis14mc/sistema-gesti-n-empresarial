'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { sileo } from 'sileo';
import { useAuth } from '@/hooks/useAuth';
import { useDepartments } from '@/hooks/useDepartments';
import { useEmployees } from '@/hooks/useEmployees';
import { employeesService } from '@/services/employees.service';
import { canAccess } from '@/platform/security/session-module-access';
import type { Employee, Role } from '@/types';
import { useEmployeesUrlState } from '@/components/employees/use-employees-url-state';
import { EmployeesFiltersBar } from '@/components/employees/EmployeesFiltersBar';
import { EmployeesTable } from '@/components/employees/EmployeesTable';
import {
  EmployeeFormDialog,
  emptyEmployeeFormValues,
  employeeToFormValues,
} from '@/components/employees/EmployeeFormDialog';
import { DeleteEmployeeDialog } from '@/components/employees/DeleteEmployeeDialog';
import { DeactivateEmployeeDialog } from '@/components/employees/DeactivateEmployeeDialog';
import { canDeleteEmployee } from '@/components/employees/can-delete-employee';
import { DischargeActaDialog } from '@/components/equipment/DischargeActaDialog';
import type { EmployeeFormValues } from '@/components/employees/EmployeeFormFields';

function apiErrorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { error?: string; message?: string; code?: string } } })
    .response?.data;
  return data?.error ?? data?.message ?? fallback;
}

export function EmployeesView() {
  const router = useRouter();
  const { user } = useAuth();
  const role = (user?.role ?? 'USER') as Role;
  const canCreate = canAccess(role, 'employees', 'create');
  const canUpdate = canAccess(role, 'employees', 'update');
  const canDelete = canDeleteEmployee(user);
  const canDischargeActa = canAccess(role, 'equipment', 'update');

  const { departments } = useDepartments();
  const { state, patchParams, filtersForApi } = useEmployeesUrlState();
  const { employees, total, page, totalPages, isLoading, createEmployee, updateEmployee, isCreating, isUpdating, refetch } =
    useEmployees(filtersForApi);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EmployeeFormValues>(emptyEmployeeFormValues);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<EmployeeFormValues>(emptyEmployeeFormValues);

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteHistoryMessage, setDeleteHistoryMessage] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const [deactivateAssets, setDeactivateAssets] = useState<{ equipos: string[]; licencias: string[] } | null>(null);
  const [dischargeEmployeeId, setDischargeEmployeeId] = useState<string | null>(null);
  const [dischargeOpen, setDischargeOpen] = useState(false);

  function handleSort(column: typeof state.sortBy) {
    if (state.sortBy === column) {
      patchParams({ sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      patchParams({ sortBy: column, sortDir: 'asc' });
    }
  }

  async function handleCreate() {
    try {
      const employee = await createEmployee({
        employeeCode: createForm.employeeCode,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        hireDate: createForm.hireDate,
        phone: createForm.phone || undefined,
        dni: createForm.dni || undefined,
        departmentId: createForm.departmentId,
        positionId: createForm.positionId,
      });
      sileo.success({ title: 'Empleado registrado' });
      setCreateOpen(false);
      setCreateForm(emptyEmployeeFormValues);
      router.push(`/employees/${employee.id}`);
    } catch (err) {
      sileo.error({ title: 'Error', description: apiErrorMessage(err, 'No se pudo registrar el empleado') });
    }
  }

  function openEdit(employee: Employee) {
    setEditTarget(employee);
    setEditForm(employeeToFormValues(employee));
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editTarget) return;
    try {
      await updateEmployee({
        id: editTarget.id,
        data: {
          employeeCode: editForm.employeeCode,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          hireDate: editForm.hireDate,
          phone: editForm.phone || undefined,
          dni: editForm.dni || undefined,
          departmentId: editForm.departmentId,
          positionId: editForm.positionId,
        },
      });
      sileo.success({ title: 'Empleado actualizado' });
      setEditOpen(false);
    } catch (err) {
      sileo.error({ title: 'Error', description: apiErrorMessage(err, 'No se pudo actualizar') });
    }
  }

  async function toggleActive(employee: Employee) {
    if (!canUpdate) return;
    try {
      await updateEmployee({ id: employee.id, data: { isActive: !employee.isActive } });
      sileo.success({ title: employee.isActive ? 'Empleado desactivado' : 'Empleado reactivado' });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
      if (data?.code === 'EMPLOYEE_HAS_ACTIVE_ASSETS') {
        setDeactivateAssets({
          equipos: (data.equipos as string[]) ?? [],
          licencias: (data.licencias as string[]) ?? [],
        });
        setDischargeEmployeeId(employee.id);
        return;
      }
      sileo.error({ title: 'No se pudo actualizar', description: apiErrorMessage(err, 'Error al cambiar estado') });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletePending(true);
    setDeleteHistoryMessage(null);
    try {
      await employeesService.delete(deleteTarget.id);
      sileo.success({ title: 'Empleado eliminado' });
      setDeleteTarget(null);
      await refetch();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; code?: string } } }).response?.data;
      if (data?.code === 'EMPLOYEE_HAS_HISTORY') {
        setDeleteHistoryMessage(data.error ?? 'Tiene historial.');
        return;
      }
      sileo.error({ title: 'Error', description: apiErrorMessage(err, 'No se pudo eliminar') });
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empleados"
        description="Personas que reciben equipos de TI (no necesariamente usuarios del sistema)"
      >
        {canCreate ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo empleado
          </Button>
        ) : null}
      </PageHeader>

      <EmployeesFiltersBar state={state} departments={departments} onPatch={patchParams} />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No hay empleados registrados</CardContent>
        </Card>
      ) : (
        <>
          <EmployeesTable
            employees={employees}
            sortBy={state.sortBy}
            sortDir={state.sortDir}
            onSort={handleSort}
            onRowClick={(employee) => router.push(`/employees/${employee.id}`)}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canDischargeActa={canDischargeActa}
            onEdit={openEdit}
            onToggleActive={toggleActive}
            onDischargeActa={(employee) => {
              setDischargeEmployeeId(employee.id);
              setDischargeOpen(true);
            }}
            onDelete={(employee) => {
              setDeleteHistoryMessage(null);
              setDeleteTarget(employee);
            }}
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} empleado{total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => patchParams({ page: String(page - 1) })}
              >
                Anterior
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
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

      <EmployeeFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Registrar empleado"
        description="El correo es obligatorio para generar formatos oficiales de entrega."
        values={createForm}
        onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
        departments={departments}
        onSubmit={handleCreate}
        pending={isCreating}
        submitLabel="Registrar"
      />

      <EmployeeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar empleado"
        values={editForm}
        onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
        departments={departments}
        onSubmit={handleEdit}
        pending={isUpdating}
      />

      <DeleteEmployeeDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteHistoryMessage(null);
          }
        }}
        employeeName={deleteTarget?.fullName ?? ''}
        onConfirm={confirmDelete}
        historyMessage={deleteHistoryMessage}
        pending={deletePending}
        onDeactivateInstead={
          deleteTarget
            ? () => {
                setDeleteTarget(null);
                void toggleActive(deleteTarget);
              }
            : undefined
        }
      />

      <DeactivateEmployeeDialog
        open={deactivateAssets !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateAssets(null);
        }}
        equipos={deactivateAssets?.equipos ?? []}
        licencias={deactivateAssets?.licencias ?? []}
        onClose={() => setDeactivateAssets(null)}
        onGenerateDischarge={() => {
          setDeactivateAssets(null);
          setDischargeOpen(true);
        }}
      />

      <DischargeActaDialog
        employeeId={dischargeEmployeeId}
        open={dischargeOpen}
        onOpenChange={setDischargeOpen}
        onGenerated={() => void refetch()}
      />
    </div>
  );
}
