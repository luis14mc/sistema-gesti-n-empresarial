'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, UserCheck, UserX, Edit3 } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import type { Role, Employee } from '@/types';

export default function EmployeesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { departments } = useDepartments();
  const { employees, isLoading, createEmployee, isCreating, updateEmployee, isUpdating } = useEmployees({
    search: search || undefined,
    pageSize: 100,
  });

  const role = (user?.role ?? 'USER') as Role;
  const canCreate = canAccess(role, 'employees', 'create');
  const canUpdate = canAccess(role, 'employees', 'update');

  const [form, setForm] = useState({
    employeeCode: '', firstName: '', lastName: '', email: '', phone: '', dni: '',
    departmentId: '', positionId: '',
  });

  const [editForm, setEditForm] = useState({
    employeeCode: '', firstName: '', lastName: '', email: '', phone: '', dni: '',
    departmentId: '', positionId: '',
  });

  const positionsFor = (departmentId: string) =>
    departments.find((d) => d.id === departmentId)?.positions ?? [];

  const filtered = employees.filter((e: Employee) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.fullName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.employeeCode?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEmployee({
        employeeCode: form.employeeCode || undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        dni: form.dni || undefined,
        departmentId: form.departmentId || undefined,
        positionId: form.positionId || undefined,
      });
      sileo.success({ title: 'Empleado registrado' });
      setDialogOpen(false);
      setForm({ employeeCode: '', firstName: '', lastName: '', email: '', phone: '', dni: '', departmentId: '', positionId: '' });
    } catch {
      sileo.error({ title: 'Error', description: 'No se pudo registrar el empleado' });
    }
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditForm({
      employeeCode: employee.employeeCode || '',
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone || '',
      dni: employee.dni || '',
      departmentId: employee.departmentId || '',
      positionId: employee.positionId || '',
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    try {
      await updateEmployee({
        id: editingEmployee.id,
        data: {
          employeeCode: editForm.employeeCode || undefined,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone || undefined,
          dni: editForm.dni || undefined,
          departmentId: editForm.departmentId || undefined,
          positionId: editForm.positionId || undefined,
        },
      });
      sileo.success({ title: 'Empleado actualizado' });
      setEditOpen(false);
    } catch {
      sileo.error({ title: 'Error', description: 'No se pudo actualizar' });
    }
  };

  const toggleActive = async (employee: Employee) => {
    if (!canUpdate) return;
    try {
      await updateEmployee({
        id: employee.id,
        data: { isActive: !employee.isActive },
      });
      sileo.success({
        title: employee.isActive ? 'Empleado desactivado' : 'Empleado activado',
      });
    } catch {
      sileo.error({ title: 'Error', description: 'No se pudo actualizar el empleado' });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Empleados"
          description="Personas que reciben equipos de TI (no necesariamente usuarios del sistema)"
        >
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Empleado</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Registrar Empleado</DialogTitle>
                  <DialogDescription>
                    El correo es obligatorio para generar formatos oficiales de entrega.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nombre *</Label>
                      <Input
                        value={form.firstName}
                        onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellido *</Label>
                      <Input
                        value={form.lastName}
                        onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Correo institucional *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Código empleado</Label>
                      <Input
                        value={form.employeeCode}
                        onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>DPI / DNI</Label>
                      <Input
                        value={form.dni}
                        onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Departamento</Label>
                      <Select value={form.departmentId} onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v, positionId: '' }))}>
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Puesto</Label>
                      <Select value={form.positionId} onValueChange={(v) => setForm((f) => ({ ...f, positionId: v }))} disabled={!form.departmentId}>
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          {positionsFor(form.departmentId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? 'Guardando...' : 'Registrar'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </PageHeader>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, correo o código..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay empleados registrados
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead className="hidden md:table-cell">Departamento</TableHead>
                    <TableHead className="hidden lg:table-cell">Equipos activos</TableHead>
                    <TableHead>Estado</TableHead>
                    {canUpdate && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((employee: Employee) => {
                    const activeCount = employee.assignments?.length ?? 0;
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <p className="font-medium">{employee.fullName}</p>
                          {employee.employeeCode && (
                            <p className="text-xs text-muted-foreground font-mono">{employee.employeeCode}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{employee.email}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {employee.department?.name ?? '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline">{activeCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                            {employee.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        {canUpdate && (
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(employee)}>
                              <Edit3 className="h-4 w-4 mr-1" /> Editar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleActive(employee)}>
                              {employee.isActive ? (
                                <><UserX className="h-4 w-4 mr-1" /> Desactivar</>
                              ) : (
                                <><UserCheck className="h-4 w-4 mr-1" /> Activar</>
                              )}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar empleado</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={editForm.departmentId} onValueChange={(v) => setEditForm((f) => ({ ...f, departmentId: v, positionId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Puesto</Label>
                <Select value={editForm.positionId} onValueChange={(v) => setEditForm((f) => ({ ...f, positionId: v }))} disabled={!editForm.departmentId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {positionsFor(editForm.departmentId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isUpdating}>{isUpdating ? 'Guardando...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
