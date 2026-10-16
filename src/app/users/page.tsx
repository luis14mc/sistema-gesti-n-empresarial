'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Filter,
  Pencil,
  ShieldCheck,
  ShieldX,
  Plus,
  KeyRound,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { getInitials, formatDate } from '@/utils/helpers';
import type { Role, User, UpdateUserData, CreateUserData, SessionUser } from '@/types';
import { useAssignableRoles, useRoleLabels } from '@/hooks/useRoleCatalog';
import { UserRoleSelect } from '@/components/users/UserRoleSelect';
import {
  PasswordFieldWithGenerate,
  clientPasswordPolicyError,
} from '@/components/users/PasswordFieldWithGenerate';
import { AdminResetPasswordDialog } from '@/components/users/AdminResetPasswordDialog';
import { usersService } from '@/services/users.service';

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
  ADMINISTRACION:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  SECRETARIA: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
  IT_MANAGER: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
};

const emptyCreateForm: CreateUserData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'ADMINISTRACION' as Role,
  employeeNumber: '',
  mustChangePassword: true,
};

const PAGE_SIZE = 20;

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listFilters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      role: roleFilter === 'ALL' ? undefined : roleFilter,
      isActive: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE' ? 'true' : 'false',
    }),
    [page, search, roleFilter, statusFilter],
  );

  const {
    users,
    total,
    totalPages,
    isLoading,
    createUser,
    isCreating,
    updateUser,
    isUpdating,
    resetPassword,
    isResettingPassword,
    removeUser,
    isRemoving,
  } = useUsers(listFilters);

  const { data: assignableRoles = [] } = useAssignableRoles();
  const { data: roleLabelRows = [] } = useRoleLabels();

  const roleLabels = useMemo(
    () => Object.fromEntries(roleLabelRows.map((row) => [row.role, row.displayName])),
    [roleLabelRows],
  );

  const canViewRolePermissions =
    (currentUser as SessionUser | null)?.moduleAccess?.settings?.extras?.includes('roles.manage') ??
    false;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserData>({ ...emptyCreateForm });
  const [createPasswordError, setCreatePasswordError] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserData>({});

  const [resetTarget, setResetTarget] = useState<User | null>(null);

  const userIdsKey = users.map((u) => u.id).join(',');
  const { data: deleteEligibility = {} } = useQuery({
    queryKey: ['users-delete-eligibility', userIdsKey],
    queryFn: async () => {
      const pairs = await Promise.all(
        users.map(async (u) => {
          const res = await usersService.deleteEligibility(u.id);
          return [u.id, res.data] as const;
        }),
      );
      return Object.fromEntries(pairs) as Record<
        string,
        { canHardDelete: boolean; referenceCount: number }
      >;
    },
    enabled: users.length > 0,
  });

  const retainedEditRole = useMemo(() => {
    if (!editUser) return null;
    const role = editForm.role ?? editUser.role;
    if (assignableRoles.some((r) => r.role === role)) return null;
    const labelRow = roleLabelRows.find((r) => r.role === role);
    return {
      role,
      displayName: labelRow?.displayName ?? role,
      description: null,
      accessibleModuleLabels: [] as string[],
    };
  }, [editUser, editForm.role, assignableRoles, roleLabelRows]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const policyError = clientPasswordPolicyError(createForm.password);
    if (policyError) {
      setCreatePasswordError(policyError);
      return;
    }
    setCreatePasswordError(null);
    if (
      !createForm.firstName ||
      !createForm.lastName ||
      !createForm.email ||
      !createForm.employeeNumber
    ) {
      sileo.error({ title: 'Campos requeridos', description: 'Completa todos los campos' });
      return;
    }
    createUser(createForm, {
      onSuccess: () => {
        sileo.success({ title: 'Usuario creado exitosamente' });
        setCreateDialogOpen(false);
        setCreateForm({ ...emptyCreateForm });
      },
      onError: () =>
        sileo.error({
          title: 'Error',
          description: 'No se pudo crear el usuario. Verifica que el email no esté duplicado.',
        }),
    });
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  };

  const toggleActive = async (user: User) => {
    const action = user.isActive ? 'desactivar' : 'activar';
    const result = await swalConfirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} usuario`,
      `¿Confirmas ${action} a ${user.firstName} ${user.lastName}?`,
      `Sí, ${action}`,
    );
    if (!result.isConfirmed) return;

    updateUser(
      { id: user.id, data: { isActive: !user.isActive } },
      {
        onSuccess: () => sileo.success({ title: `Usuario ${user.isActive ? 'desactivado' : 'activado'}` }),
        onError: () => sileo.error({ title: 'Error', description: 'No se pudo actualizar' }),
      },
    );
  };

  const handleHardDelete = async (user: User) => {
    const result = await swalConfirm(
      'Eliminar usuario',
      `¿Eliminar definitivamente a ${user.firstName} ${user.lastName}? Esta acción no se puede deshacer.`,
      'Eliminar',
    );
    if (!result.isConfirmed) return;
    try {
      await removeUser({ id: user.id, hard: true });
      sileo.success({ title: 'Usuario eliminado' });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      sileo.error({
        title: 'No se pudo eliminar',
        description: message ?? 'Intente desactivar el usuario.',
      });
    }
  };

  const handleSave = () => {
    if (!editUser) return;
    updateUser(
      { id: editUser.id, data: editForm },
      {
        onSuccess: () => {
          sileo.success({ title: 'Usuario actualizado' });
          setEditUser(null);
        },
        onError: () => sileo.error({ title: 'Error', description: 'No se pudo actualizar' }),
      },
    );
  };

  return (
    <MainLayout>
      <TooltipProvider delayDuration={300}>
        <div className="space-y-6">
          <PageHeader
            title="Gestión de Usuarios"
            description="Administración de cuentas y roles del sistema"
          >
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Crear Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nuevo Usuario</DialogTitle>
                  <DialogDescription>Crea una cuenta nueva con rol asignado.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={createForm.firstName}
                        onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellido</Label>
                      <Input
                        value={createForm.lastName}
                        onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>No. Empleado</Label>
                    <Input
                      value={createForm.employeeNumber ?? ''}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, employeeNumber: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                  <PasswordFieldWithGenerate
                    value={createForm.password}
                    onChange={(v) => setCreateForm((f) => ({ ...f, password: v }))}
                    error={createPasswordError}
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="create-must-change"
                      checked={createForm.mustChangePassword ?? true}
                      onCheckedChange={(v) =>
                        setCreateForm((f) => ({ ...f, mustChangePassword: v === true }))
                      }
                    />
                    <Label htmlFor="create-must-change" className="font-normal cursor-pointer">
                      Pedir cambio al iniciar sesión
                    </Label>
                  </div>
                  <UserRoleSelect
                    value={createForm.role}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v as Role }))}
                    options={assignableRoles}
                    canViewRolePermissions={canViewRolePermissions}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? 'Creando...' : 'Crear Usuario'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </PageHeader>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, correo o No. empleado..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los roles</SelectItem>
                {Object.entries(roleLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="ACTIVE">Activo</SelectItem>
                <SelectItem value="INACTIVE">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No se encontraron usuarios
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="hidden md:table-cell">Estado</TableHead>
                      <TableHead className="hidden lg:table-cell">Registro</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: User) => {
                      const eligibility = deleteEligibility[user.id];
                      const canHardDelete = eligibility?.canHardDelete === true;
                      const deleteDisabled =
                        user.id === currentUser?.id || !canHardDelete || isRemoving;
                      const deleteTooltip =
                        user.id === currentUser?.id
                          ? 'No puede eliminar su propia cuenta'
                          : !canHardDelete
                            ? 'Tiene historial; desactívelo en su lugar'
                            : 'Eliminar definitivamente';

                      return (
                        <TableRow key={user.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {getInitials(`${user.firstName} ${user.lastName}`)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground sm:hidden truncate">
                                  {user.email}
                                </p>
                                {user.employeeNumber ? (
                                  <p className="text-xs text-muted-foreground hidden sm:block">
                                    {user.employeeNumber}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={roleColors[user.role] ?? 'bg-muted text-muted-foreground'}
                            >
                              {roleLabels[user.role] ?? user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {user.isActive ? (
                              <Badge
                                variant="outline"
                                className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900"
                              >
                                Activo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                                Inactivo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/users/${user.id}`}>
                                      <ShieldCheck className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Permisos</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setResetTarget(user)}
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restablecer contraseña</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleActive(user)}
                                    disabled={user.id === currentUser?.id}
                                  >
                                    {user.isActive ? (
                                      <ShieldX className="h-4 w-4 text-destructive" />
                                    ) : (
                                      <ShieldCheck className="h-4 w-4 text-green-500" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {user.isActive ? 'Desactivar' : 'Activar'}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={deleteDisabled}
                                      onClick={() => handleHardDelete(user)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{deleteTooltip}</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
                  <span>
                    {total} usuario{total === 1 ? '' : 's'} · página {page} de {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label="Página siguiente"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          )}

          <AdminResetPasswordDialog
            user={resetTarget}
            open={Boolean(resetTarget)}
            onOpenChange={(open) => !open && setResetTarget(null)}
            isSubmitting={isResettingPassword}
            onSubmit={async (payload) => {
              if (!resetTarget) return;
              try {
                await resetPassword({ id: resetTarget.id, ...payload });
                sileo.success({ title: 'Contraseña restablecida' });
              } catch {
                sileo.error({ title: 'Error', description: 'No se pudo restablecer la contraseña' });
                throw new Error('reset failed');
              }
            }}
          />

          <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Editar Usuario</DialogTitle>
                <DialogDescription>
                  Modifica los datos de {editUser?.firstName} {editUser?.lastName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={editForm.firstName ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido</Label>
                    <Input
                      value={editForm.lastName ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <UserRoleSelect
                  value={editForm.role ?? editUser?.role ?? 'ADMINISTRACION'}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as Role }))}
                  options={assignableRoles}
                  retainedOption={retainedEditRole}
                  canViewRolePermissions={canViewRolePermissions}
                />
                <div className="flex items-center justify-between">
                  <Label>Usuario activo</Label>
                  <Switch
                    checked={editForm.isActive ?? true}
                    onCheckedChange={(v) => setEditForm((f) => ({ ...f, isActive: v }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditUser(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </MainLayout>
  );
}
