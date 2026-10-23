'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useDepartments } from '@/hooks/useDepartments';
import { useEmployee } from '@/hooks/useEmployee';
import { useEmployees } from '@/hooks/useEmployees';
import { employeesService } from '@/services/employees.service';
import { apiHelpers } from '@/utils/api';
import { canAccess } from '@/platform/security/session-module-access';
import type { Employee, EquipmentAssignment, Role } from '@/types';
import { EmployeeLicensesSection, type EmployeeLicenseRow } from '@/components/software-licenses/EmployeeLicensesSection';
import { actaDownloadUrl } from '@/components/equipment/assignments/utils';
import { canDeleteEmployee } from '@/components/employees/can-delete-employee';
import {
  EmployeeFormDialog,
  employeeToFormValues,
  emptyEmployeeFormValues,
} from '@/components/employees/EmployeeFormDialog';
import { DeleteEmployeeDialog } from '@/components/employees/DeleteEmployeeDialog';
import { DeactivateEmployeeDialog } from '@/components/employees/DeactivateEmployeeDialog';
import { DischargeActaDialog } from '@/components/equipment/DischargeActaDialog';
import { EmployeePayrollTab } from '@/components/employees/EmployeePayrollTab';
import type { EmployeeFormValues } from '@/components/employees/EmployeeFormFields';
import { sileo } from 'sileo';
import { useEffect } from 'react';

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

type Props = { employeeId: string };

export function EmployeeProfileView({ employeeId }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const role = (user?.role ?? 'USER') as Role;
  const canUpdate = canAccess(role, 'employees', 'update');
  const canDelete = canDeleteEmployee(user);
  const canDischargeActa = canAccess(role, 'equipment', 'update');
  const canEquipmentRead = canAccess(role, 'equipment', 'read');
  const canLicensesRead = canAccess(role, 'software-licenses', 'read');
  const canPayrollRead = canAccess(role, 'payroll', 'read');
  const canPayrollEdit = canAccess(role, 'payroll', 'update');

  const { data: employee, isLoading, refetch } = useEmployee(employeeId);
  const { departments } = useDepartments();
  const { updateEmployee, isUpdating } = useEmployees();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EmployeeFormValues>(emptyEmployeeFormValues);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteHistoryMessage, setDeleteHistoryMessage] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deactivateAssets, setDeactivateAssets] = useState<{ equipos: string[]; licencias: string[] } | null>(null);
  const [dischargeOpen, setDischargeOpen] = useState(false);

  const [licencias, setLicencias] = useState<EmployeeLicenseRow[]>([]);
  const [activeEquipos, setActiveEquipos] = useState<
    Array<{ assignmentId: string; codigo: string; nombre: string }>
  >([]);
  const [dischargeActas, setDischargeActas] = useState<Array<{ id: string; label: string; downloadUrl: string }>>([]);
  const [historyRecords, setHistoryRecords] = useState<
    Array<{ id: string; title: string; description: string; createdAt: string }>
  >([]);

  useEffect(() => {
    if (!employeeId || !canEquipmentRead) return;
    void apiHelpers
      .get<{ licencias: EmployeeLicenseRow[]; equipos: Array<{ assignmentId: string; codigo: string; nombre: string }> }>(
        `/api/employees/${employeeId}/assets`,
      )
      .then((res) => {
        setActiveEquipos(res.data.equipos ?? []);
        if (canLicensesRead) setLicencias(res.data.licencias ?? []);
      })
      .catch(() => undefined);
  }, [employeeId, canEquipmentRead, canLicensesRead]);

  useEffect(() => {
    if (!employeeId || !canDischargeActa) return;
    void apiHelpers
      .get<{ actas: Array<{ id: string; createdAt: string; url: string | null }> }>(
        `/api/employees/${employeeId}/discharge-acta?mode=history`,
      )
      .then((res) => {
        setDischargeActas(
          (res.data.actas ?? []).map((a) => ({
            id: a.id,
            label: `Descargo · ${a.createdAt?.slice(0, 10) ?? a.id}`,
            downloadUrl: a.url ?? '#',
          })),
        );
      })
      .catch(() => undefined);
  }, [employeeId, canDischargeActa]);

  useEffect(() => {
    void employeesService.history(employeeId, { page: 1, pageSize: 50 }).then((res) => {
      setHistoryRecords(res.data.records ?? []);
    });
  }, [employeeId]);

  const assignmentHistory = useMemo(
    () => (employee?.assignments ?? []) as EquipmentAssignment[],
    [employee?.assignments],
  );

  async function toggleActive(target: Employee) {
    try {
      await updateEmployee({ id: target.id, data: { isActive: !target.isActive } });
      sileo.success({ title: target.isActive ? 'Empleado desactivado' : 'Empleado reactivado' });
      await refetch();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
      if (data?.code === 'EMPLOYEE_HAS_ACTIVE_ASSETS') {
        setDeactivateAssets({
          equipos: (data.equipos as string[]) ?? [],
          licencias: (data.licencias as string[]) ?? [],
        });
        return;
      }
      sileo.error({ title: 'No se pudo cambiar el estado' });
    }
  }

  async function confirmDelete() {
    setDeletePending(true);
    try {
      await employeesService.delete(employeeId);
      sileo.success({ title: 'Empleado eliminado' });
      router.push('/employees');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; code?: string } } }).response?.data;
      if (data?.code === 'EMPLOYEE_HAS_HISTORY') {
        setDeleteHistoryMessage(data.error ?? 'Tiene historial.');
        return;
      }
      sileo.error({ title: 'No se pudo eliminar' });
    } finally {
      setDeletePending(false);
    }
  }

  if (isLoading || !employee) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Empleados', href: '/employees' },
          { label: employee.fullName },
        ]}
        title=""
        description=""
      />

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4">
        <div className="flex gap-4">
          <Avatar className="size-14">
            <AvatarFallback>{initials(employee.fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">{employee.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {employee.employeeCode ?? '—'} · {[employee.position?.name, employee.department?.name].filter(Boolean).join(' · ')}
            </p>
            <Badge className="mt-2" variant={employee.isActive ? 'default' : 'secondary'}>
              {employee.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditForm(employeeToFormValues(employee));
                setEditOpen(true);
              }}
            >
              Editar
            </Button>
          ) : null}
          {canUpdate ? (
            <Button type="button" variant="outline" onClick={() => void toggleActive(employee)}>
              {employee.isActive ? 'Desactivar' : 'Reactivar'}
            </Button>
          ) : null}
          {canDischargeActa ? (
            <Button type="button" variant="outline" onClick={() => setDischargeOpen(true)}>
              Acta de descargo
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteHistoryMessage(null);
                setDeleteOpen(true);
              }}
            >
              Eliminar
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          {canEquipmentRead || canLicensesRead ? <TabsTrigger value="activos">Activos</TabsTrigger> : null}
          {canEquipmentRead ? <TabsTrigger value="actas">Actas</TabsTrigger> : null}
          {canPayrollRead ? <TabsTrigger value="planilla">Planilla</TabsTrigger> : null}
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4 space-y-2 text-sm">
          <p><span className="text-muted-foreground">Correo:</span> {employee.email}</p>
          <p><span className="text-muted-foreground">DNI:</span> {employee.dni ?? '—'}</p>
          <p><span className="text-muted-foreground">Teléfono:</span> {employee.phone ?? '—'}</p>
          <p>
            <span className="text-muted-foreground">Fecha de ingreso:</span>{' '}
            {employee.hireDate ? new Date(`${employee.hireDate.slice(0, 10)}T00:00:00`).toLocaleDateString('es-HN') : '—'}
          </p>
          {employee.user ? (
            <p>
              <span className="text-muted-foreground">Usuario del sistema:</span>{' '}
              {employee.user.firstName} {employee.user.lastName} ({employee.user.email})
            </p>
          ) : (
            <p className="text-muted-foreground">Sin usuario del sistema vinculado</p>
          )}
          <p className="text-xs text-muted-foreground">
            Creado {new Date(employee.createdAt).toLocaleString('es-HN')} · Actualizado{' '}
            {new Date(employee.updatedAt).toLocaleString('es-HN')}
          </p>
        </TabsContent>

        {canEquipmentRead || canLicensesRead ? (
          <TabsContent value="activos" className="mt-4 space-y-6">
            {canEquipmentRead ? (
              <section>
                <h2 className="font-medium">Equipos asignados</h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {activeEquipos.length === 0 ? (
                    <li className="text-muted-foreground">Sin equipos activos</li>
                  ) : (
                    activeEquipos.map((eq) => (
                      <li key={eq.assignmentId}>
                        <Link href={`/activos/asignaciones/${eq.assignmentId}`} className="text-primary hover:underline">
                          {eq.codigo} · {eq.nombre}
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
                {assignmentHistory.length > 0 ? (
                  <>
                    <h3 className="mt-4 text-sm font-medium text-muted-foreground">Historial de asignaciones</h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {assignmentHistory.map((a) => (
                        <li key={a.id}>
                          <Link href={`/activos/asignaciones/${a.id}`} className="hover:underline">
                            {a.status} · {a.assignedDate?.slice(0, 10)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            ) : null}
            {canLicensesRead && employee ? (
              <EmployeeLicensesSection
                role={role}
                employee={{ id: employee.id, fullName: employee.fullName }}
                licencias={licencias}
                onRefresh={() => void refetch()}
              />
            ) : null}
          </TabsContent>
        ) : null}

        {canEquipmentRead ? (
          <TabsContent value="actas" className="mt-4 space-y-4">
            <section>
              <h2 className="font-medium">Entrega y devolución</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {assignmentHistory.map((a) => (
                  <li key={a.id} className="flex flex-wrap gap-3">
                    <a href={actaDownloadUrl(a.id, 'delivery')} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Entrega · {a.id.slice(0, 8)}
                    </a>
                    {a.returnDocumentUrl || a.status === 'RETURNED' ? (
                      <a href={actaDownloadUrl(a.id, 'return')} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Devolución
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="font-medium">Descargo</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {dischargeActas.length === 0 ? (
                  <li className="text-muted-foreground">Sin actas de descargo</li>
                ) : (
                  dischargeActas.map((a) => (
                    <li key={a.id}>
                      <a href={a.downloadUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {a.label}
                      </a>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </TabsContent>
        ) : null}

        {canPayrollRead ? (
          <TabsContent value="planilla" className="mt-4">
            <EmployeePayrollTab employeeId={employeeId} canEdit={canPayrollEdit} />
          </TabsContent>
        ) : null}

        <TabsContent value="historial" className="mt-4">
          <ul className="space-y-3 text-sm">
            {historyRecords.length === 0 ? (
              <li className="text-muted-foreground">Sin registros de auditoría</li>
            ) : (
              historyRecords.map((row) => (
                <li key={row.id} className="rounded-md border p-3">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-muted-foreground">{row.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString('es-HN')}
                  </p>
                </li>
              ))
            )}
          </ul>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar empleado"
        values={editForm}
        onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
        departments={departments}
        onSubmit={async () => {
          await updateEmployee({
            id: employee.id,
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
          await refetch();
        }}
        pending={isUpdating}
      />

      <DeleteEmployeeDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        employeeName={employee.fullName}
        onConfirm={confirmDelete}
        historyMessage={deleteHistoryMessage}
        pending={deletePending}
        onDeactivateInstead={() => {
          setDeleteOpen(false);
          void toggleActive(employee);
        }}
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

      <DischargeActaDialog employeeId={employeeId} open={dischargeOpen} onOpenChange={setDischargeOpen} />
    </div>
  );
}
