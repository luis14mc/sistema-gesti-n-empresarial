'use client';

import { useState } from 'react';
import { sileo } from 'sileo';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Pencil, Plus, RefreshCw, Search, Trash2,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useCreateProveedor, useDeleteProveedor, useProveedores, useUpdateProveedor,
} from '@/hooks/useCompras';
import { canAccess } from '@/lib/permissions';
import type { Role } from '@/types';
import type { Proveedor } from '@/types/compras';

type ProveedorForm = {
  nombreRazonSocial: string;
  rtn: string;
  telefono: string;
  email: string;
  personaContacto: string;
  direccion: string;
};

const EMPTY_FORM: ProveedorForm = {
  nombreRazonSocial: '',
  rtn: '',
  telefono: '',
  email: '',
  personaContacto: '',
  direccion: '',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export default function ComprasProveedoresPage() {
  const { user } = useAuth();
  const role = user?.role as Role | undefined;
  const canCreate = !!role && canAccess(role, 'purchases', 'create');
  const canUpdate = !!role && canAccess(role, 'purchases', 'update');
  const canDelete = !!role && canAccess(role, 'purchases', 'delete');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const { data, isLoading, isFetching, refetch } = useProveedores({
    search: debouncedSearch,
    page,
    pageSize,
  });
  const proveedores = data?.proveedores ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const createProveedor = useCreateProveedor();
  const updateProveedor = useUpdateProveedor();
  const deleteProveedor = useDeleteProveedor();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Proveedor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);

  const [form, setForm] = useState<ProveedorForm>(EMPTY_FORM);

  if (!user) return null;

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const onPageSizeChange = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const openEdit = (p: Proveedor) => {
    setEditTarget(p);
    setForm({
      nombreRazonSocial: p.nombreRazonSocial ?? '',
      rtn: p.rtn ?? '',
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      personaContacto: p.personaContacto ?? '',
      direccion: p.direccion ?? '',
    });
  };

  const closeDialogs = () => {
    setCreateOpen(false);
    setEditTarget(null);
  };

  const buildPayload = (f: ProveedorForm) => ({
    nombreRazonSocial: f.nombreRazonSocial.trim(),
    rtn: f.rtn.trim() || null,
    telefono: f.telefono.trim() || null,
    email: f.email.trim() || null,
    personaContacto: f.personaContacto.trim() || null,
    direccion: f.direccion.trim() || null,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProveedor.mutateAsync(buildPayload(form));
      sileo.success({ title: 'Proveedor registrado' });
      closeDialogs();
      setPage(1);
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear el proveedor',
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    try {
      await updateProveedor.mutateAsync({ id: editTarget.id, data: buildPayload(form) });
      sileo.success({ title: 'Proveedor actualizado' });
      closeDialogs();
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el proveedor',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProveedor.mutateAsync(deleteTarget.id);
      sileo.success({ title: 'Proveedor eliminado' });
      setDeleteTarget(null);
      if (proveedores.length === 1 && page > 1) setPage(page - 1);
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo eliminar el proveedor',
      });
    }
  };

  const renderForm = (onSubmit: (e: React.FormEvent) => void, isSubmitting: boolean, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Razón social *</Label>
        <Input
          value={form.nombreRazonSocial}
          onChange={(e) => setForm((f) => ({ ...f, nombreRazonSocial: e.target.value }))}
          required
          minLength={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>RTN</Label>
          <Input
            value={form.rtn}
            onChange={(e) => setForm((f) => ({ ...f, rtn: e.target.value }))}
            placeholder="8 a 15 dígitos"
          />
        </div>
        <div className="space-y-2">
          <Label>Teléfono</Label>
          <Input
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Contacto</Label>
          <Input
            value={form.personaContacto}
            onChange={(e) => setForm((f) => ({ ...f, personaContacto: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Dirección</Label>
        <Input
          value={form.direccion}
          onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialogs} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <MainLayout>
      <PageHeader
        title="Proveedores"
        description="Gestión de proveedores para órdenes de compra"
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RTN..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refrescar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo proveedor
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razón social</TableHead>
                <TableHead>RTN</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[100px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : proveedores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {search ? 'Sin resultados para la búsqueda.' : 'No hay proveedores registrados.'}
                  </TableCell>
                </TableRow>
              ) : (
                proveedores.map((p) => (
                  <TableRow key={p.id} className={isFetching ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{p.nombreRazonSocial}</TableCell>
                    <TableCell>{p.rtn ?? '—'}</TableCell>
                    <TableCell>{p.personaContacto ?? '—'}</TableCell>
                    <TableCell>{p.telefono ?? '—'}</TableCell>
                    <TableCell>{p.email ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canUpdate && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} aria-label="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
        <div className="text-muted-foreground">
          {total === 0 ? 'Sin registros' : `Mostrando ${start}–${end} de ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Por página</Label>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(1)}
              disabled={page <= 1 || isFetching}
              aria-label="Primera página"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || isFetching}
              aria-label="Última página"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar proveedor</DialogTitle>
            <DialogDescription>
              Complete los datos del nuevo proveedor.
            </DialogDescription>
          </DialogHeader>
          {renderForm(handleCreate, createProveedor.isPending, 'Registrar')}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
            <DialogDescription>Modifique los datos del proveedor.</DialogDescription>
          </DialogHeader>
          {renderForm(handleUpdate, updateProveedor.isPending, 'Guardar cambios')}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar proveedor</DialogTitle>
            <DialogDescription>
              ¿Está seguro de eliminar a <strong>{deleteTarget?.nombreRazonSocial}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteProveedor.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteProveedor.isPending}>
              {deleteProveedor.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
