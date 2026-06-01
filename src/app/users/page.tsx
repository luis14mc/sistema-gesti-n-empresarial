'use client';

// ============================================
// USERS CRUD PAGE — Gestión de usuarios (ADMIN)
// ============================================

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Search, Filter, Pencil, ShieldCheck, ShieldX, Plus, Eye, EyeOff } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { getInitials, formatDate } from '@/utils/helpers';
import type { Role, User, UpdateUserData, CreateUserData } from '@/types';

// ============================================
// ROLE CONFIG
// ============================================

const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador', USER: 'Usuario', RRHH: 'Recursos Humanos', IT: 'Sistemas / TI',
};

const roleColors: Record<string, string> = {
    ADMIN: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
    USER: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    RRHH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    IT: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
};

// ============================================
// INITIAL FORM STATE
// ============================================

const emptyCreateForm: CreateUserData = {
    firstName: '', lastName: '', email: '', password: '', role: 'USER' as Role, employeeNumber: '',
};

// ============================================
// PAGE
// ============================================

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const { users, isLoading, createUser, isCreating, updateUser, isUpdating } = useUsers();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');

    // Create dialog state
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createForm, setCreateForm] = useState<CreateUserData>({ ...emptyCreateForm });
    const [showPw, setShowPw] = useState(false);

    // Edit dialog state
    const [editUser, setEditUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<UpdateUserData>({});

    const filtered = users.filter((u: User) => {
        const matchSearch =
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    // ── Create user ──────────────────────────
    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password || !createForm.employeeNumber) {
            sileo.error({ title: 'Campos requeridos', description: 'Completa todos los campos' });
            return;
        }
        if (createForm.password.length < 6) {
            sileo.error({ title: 'Contraseña muy corta', description: 'Mínimo 6 caracteres' });
            return;
        }
        createUser(createForm, {
            onSuccess: () => {
                sileo.success({ title: 'Usuario creado exitosamente' });
                setCreateDialogOpen(false);
                setCreateForm({ ...emptyCreateForm });
                setShowPw(false);
            },
            onError: () => sileo.error({ title: 'Error', description: 'No se pudo crear el usuario. Verifica que el email no esté duplicado.' }),
        });
    };

    // ── Open edit dialog ─────────────────────
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

    // ── Toggle active status ─────────────────
    const toggleActive = async (user: User) => {
        const action = user.isActive ? 'desactivar' : 'activar';
        const result = await swalConfirm(
            `${action.charAt(0).toUpperCase() + action.slice(1)} usuario`,
            `¿Confirmas ${action} a ${user.firstName} ${user.lastName}?`,
            `Sí, ${action}`
        );
        if (!result.isConfirmed) return;

        updateUser(
            { id: user.id, data: { isActive: !user.isActive } },
            {
                onSuccess: () => sileo.success({ title: `Usuario ${user.isActive ? 'desactivado' : 'activado'}` }),
                onError: () => sileo.error({ title: 'Error', description: 'No se pudo actualizar' }),
            }
        );
    };

    // ── Save edit ────────────────────────────
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
            }
        );
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Gestión de Usuarios" description="Administración de cuentas y roles del sistema">
                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="h-4 w-4 mr-2" /> Crear Usuario</Button>
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
                                            placeholder="Juan"
                                            value={createForm.firstName}
                                            onChange={(e) => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Apellido</Label>
                                        <Input
                                            placeholder="Pérez"
                                            value={createForm.lastName}
                                            onChange={(e) => setCreateForm(f => ({ ...f, lastName: e.target.value }))}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>No. Empleado</Label>
                                    <Input
                                        placeholder="EMP-001"
                                        value={createForm.employeeNumber ?? ''}
                                        onChange={(e) => setCreateForm(f => ({ ...f, employeeNumber: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        placeholder="juan.perez@empresa.com"
                                        value={createForm.email}
                                        onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Contraseña</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPw ? 'text' : 'password'}
                                            placeholder="Mínimo 6 caracteres"
                                            value={createForm.password}
                                            onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                                            required
                                            minLength={6}
                                        />
                                        <Button
                                            type="button" variant="ghost" size="icon"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                            onClick={() => setShowPw(!showPw)}
                                        >
                                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Rol</Label>
                                    <Select
                                        value={createForm.role}
                                        onValueChange={(v) => setCreateForm(f => ({ ...f, role: v as Role }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(roleLabels).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={isCreating}>
                                        {isCreating ? 'Creando...' : 'Crear Usuario'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </PageHeader>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por nombre o email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full sm:w-44">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Rol" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos los roles</SelectItem>
                            {Object.entries(roleLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
                ) : filtered.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">No se encontraron usuarios</CardContent></Card>
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
                                    {filtered.map((user: User) => (
                                        <TableRow key={user.id} className="hover:bg-muted/50">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                            {getInitials(`${user.firstName} ${user.lastName}`)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
                                                        <p className="text-xs text-muted-foreground sm:hidden truncate">{user.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                                {user.email}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={roleColors[user.role]}>
                                                    {roleLabels[user.role]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {user.isActive ? (
                                                    <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900">
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
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Editar">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        onClick={() => toggleActive(user)}
                                                        title={user.isActive ? 'Desactivar' : 'Activar'}
                                                        disabled={user.id === currentUser?.id}
                                                    >
                                                        {user.isActive ? (
                                                            <ShieldX className="h-4 w-4 text-destructive" />
                                                        ) : (
                                                            <ShieldCheck className="h-4 w-4 text-green-500" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {/* Edit Dialog */}
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
                                    <Input value={editForm.firstName ?? ''} onChange={(e) => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Apellido</Label>
                                    <Input value={editForm.lastName ?? ''} onChange={(e) => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={editForm.email ?? ''} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Rol</Label>
                                <Select value={editForm.role ?? 'USER'} onValueChange={(v) => setEditForm(f => ({ ...f, role: v as Role }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(roleLabels).map(([k, v]) => (
                                            <SelectItem key={k} value={k}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Usuario activo</Label>
                                <Switch
                                    checked={editForm.isActive ?? true}
                                    onCheckedChange={(v) => setEditForm(f => ({ ...f, isActive: v }))}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={isUpdating}>
                                {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
