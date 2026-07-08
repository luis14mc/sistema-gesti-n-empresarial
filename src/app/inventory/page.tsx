'use client';

// ============================================
// INVENTORY PAGE — Inventario Promocional
// ============================================
// CRUD completo: crear, ver detalle, editar, eliminar,
// registrar movimientos (entrada, salida, retorno, ajuste)

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Plus, Search, Filter, Edit3, Trash2, ArrowDown, ArrowUp,
    RotateCcw, Settings2, Package,
} from 'lucide-react';
import { usePromotionalItems, usePromotionalItemDetail } from '@/hooks/usePromotionalItems';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/shared/Pagination';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { formatRelativeDate } from '@/utils/helpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Role, PromotionalStatus, MovementType } from '@/types';

// ============================================
// CONSTANTS
// ============================================

const statusColors: Record<string, string> = {
    IN_STOCK: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
    OUT_FOR_EVENT: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    DAMAGED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
    LOST: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
    IN_STOCK: 'En Stock', OUT_FOR_EVENT: 'En Evento', DAMAGED: 'Dañado', LOST: 'Perdido',
};

const movementLabels: Record<string, string> = {
    ENTRY: 'Entrada', EXIT: 'Salida', RETURN: 'Retorno', ADJUSTMENT: 'Ajuste',
};

const movementIcons: Record<string, typeof ArrowDown> = {
    ENTRY: ArrowDown, EXIT: ArrowUp, RETURN: RotateCcw, ADJUSTMENT: Settings2,
};

const movementColors: Record<string, string> = {
    ENTRY: 'text-green-600', EXIT: 'text-red-600', RETURN: 'text-blue-600', ADJUSTMENT: 'text-amber-600',
};

// ============================================
// PAGE
// ============================================

export default function InventoryPage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);

    const {
        items,
        total,
        totalPages,
        isLoading,
        createItem,
        isCreating,
        deleteItem,
        isDeleting
    } = usePromotionalItems({
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? undefined : statusFilter as any,
        page,
        pageSize: 10
    });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const sheetOpen = selectedItemId !== null;

    const role = (user?.role ?? 'USER') as Role;
    const canCreate = canAccess(role, 'inventory', 'create');
    const canDelete = canAccess(role, 'inventory', 'delete');

    const [form, setForm] = useState({ name: '', description: '', quantity: '', unitPrice: '', purchaseDate: '' });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createItem({
                name: form.name,
                description: form.description || undefined,
                quantity: parseInt(form.quantity),
                unitPrice: parseFloat(form.unitPrice),
                purchaseDate: form.purchaseDate,
            } as any);
            sileo.success({ title: 'Artículo creado', description: 'Se registró correctamente' });
            setDialogOpen(false);
            setForm({ name: '', description: '', quantity: '', unitPrice: '', purchaseDate: '' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo crear el artículo' });
        }
    };

    const handleDeleteFromTable = async (id: string, name: string) => {
        const result = await swalConfirm('¿Eliminar artículo?', `"${name}" se eliminará permanentemente.`, 'Sí, eliminar');
        if (!result.isConfirmed) return;
        try {
            await deleteItem(id);
            sileo.success({ title: 'Artículo eliminado' });
            if (selectedItemId === id) setSelectedItemId(null);
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Inventario Promocional" description="Control de artículos y movimientos">
                    {canCreate && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Artículo</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Nuevo Artículo</DialogTitle>
                                    <DialogDescription>Registra un nuevo artículo en el inventario.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nombre *</Label>
                                        <Input placeholder="Camiseta institucional" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Descripción</Label>
                                        <Input placeholder="Descripción opcional" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Cantidad inicial *</Label>
                                            <Input type="number" min="0" placeholder="100" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Precio unitario *</Label>
                                            <Input type="number" step="0.01" min="0" placeholder="25.00" value={form.unitPrice} onChange={(e) => setForm(f => ({ ...f, unitPrice: e.target.value }))} required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha de Compra *</Label>
                                        <Input type="date" value={form.purchaseDate} onChange={(e) => setForm(f => ({ ...f, purchaseDate: e.target.value }))} required />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isCreating}>{isCreating ? 'Creando...' : 'Crear Artículo'}</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </PageHeader>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por nombre o código..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-44">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            {Object.entries(statusLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>

                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Artículo</TableHead>
                                    <TableHead className="text-right">Cantidad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="hidden md:table-cell text-right">Costo Unit.</TableHead>
                                    {canDelete && <TableHead className="w-10" />}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            No se encontraron artículos
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => setSelectedItemId(item.id)}
                                        >
                                            <TableCell className="font-mono text-xs font-semibold">
                                                {item.code}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-muted rounded-md shrink-0">
                                                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </div>
                                                    <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium tabular-nums">
                                                {item.quantity}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusColors[item.status]}>
                                                    {statusLabels[item.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground">
                                                {item.unitCost ? `$${item.unitCost.toLocaleString()}` : '—'}
                                            </TableCell>
                                            {canDelete && (
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteFromTable(item.id, item.name)}
                                                        disabled={isDeleting}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        isLoading={isLoading}
                    />
                </Card>
            </div>

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) setSelectedItemId(null); }}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                    {selectedItemId && (
                        <ItemDetailPanel
                            itemId={selectedItemId}
                            role={role}
                            onClose={() => setSelectedItemId(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </MainLayout>
    );
}

// ============================================
// DETAIL PANEL
// ============================================

function ItemDetailPanel({ itemId, role, onClose }: { itemId: string; role: Role; onClose: () => void }) {
    const { item, isLoading, updateItem, isUpdating, deleteItem, isDeleting, addMovement, isAddingMovement } = usePromotionalItemDetail(itemId);
    const canUpdate = canAccess(role, 'inventory', 'update');
    const canDelete = canAccess(role, 'inventory', 'delete');
    const [editing, setEditing] = useState(false);
    const [movementOpen, setMovementOpen] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', description: '', unitCost: '', status: '' });
    const [movForm, setMovForm] = useState({ type: 'EXIT', quantity: '', reason: '', notes: '' });

    if (isLoading || !item) {
        return (
            <div className="space-y-4 pt-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    const handleDelete = async () => {
        const result = await swalConfirm('¿Eliminar artículo?', `"${item.name}" se eliminará permanentemente.`, 'Sí, eliminar');
        if (!result.isConfirmed) return;
        try {
            await deleteItem();
            sileo.success({ title: 'Artículo eliminado' });
            onClose();
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    const startEditing = () => {
        setEditForm({
            name: item.name, description: item.description || '',
            unitCost: item.unitCost?.toString() || '', status: item.status,
        });
        setEditing(true);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateItem({
                name: editForm.name, description: editForm.description || undefined,
                unitCost: editForm.unitCost ? parseFloat(editForm.unitCost) : undefined,
                status: editForm.status as PromotionalStatus,
            });
            setEditing(false);
            sileo.success({ title: 'Artículo actualizado' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar' });
        }
    };

    const handleMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addMovement({
                itemId: item.id,
                type: movForm.type as MovementType,
                quantity: parseInt(movForm.quantity),
                reason: movForm.reason,
                notes: movForm.notes || undefined,
            });
            setMovementOpen(false);
            setMovForm({ type: 'EXIT', quantity: '', reason: '', notes: '' });
            sileo.success({ title: 'Movimiento registrado' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo registrar el movimiento' });
        }
    };

    const totalValue = item.unitCost ? item.quantity * item.unitCost : null;

    return (
        <div className="space-y-6 pt-2">
            <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs text-muted-foreground font-mono mb-1">{item.code}</p>
                        <SheetTitle className="text-lg font-heading leading-snug">{item.name}</SheetTitle>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        {canUpdate && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditing}><Edit3 className="h-4 w-4" /></Button>
                        )}
                        {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                        )}
                    </div>
                </div>
            </SheetHeader>

            {/* Badge + Quantity */}
            <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className={statusColors[item.status]}>{statusLabels[item.status]}</Badge>
                <div className="text-2xl font-bold tabular-nums">{item.quantity}</div>
                <span className="text-sm text-muted-foreground">unidades</span>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                {item.unitCost && (
                    <div><p className="text-xs text-muted-foreground">Costo unitario</p><p className="font-medium">${item.unitCost.toLocaleString()}</p></div>
                )}
                {totalValue && (
                    <div><p className="text-xs text-muted-foreground">Valor total</p><p className="font-medium">${totalValue.toLocaleString()}</p></div>
                )}
                <div><p className="text-xs text-muted-foreground">Registrado</p><p className="font-medium">{formatRelativeDate(item.createdAt)}</p></div>
            </div>

            {item.description && (
                <div>
                    <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3">{item.description}</p>
                </div>
            )}

            <Separator />

            {/* Register movement */}
            {canUpdate && (
                <Button variant="outline" className="w-full" onClick={() => setMovementOpen(true)}>
                    <ArrowUp className="h-4 w-4 mr-2" /> Registrar Movimiento
                </Button>
            )}

            {/* Movement history */}
            <div className="space-y-2">
                <p className="text-sm font-semibold">Movimientos recientes</p>
                {(!item.movements || item.movements.length === 0) ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">Sin movimientos registrados</p>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {item.movements.map(m => {
                            const Icon = movementIcons[m.type] ?? Settings2;
                            return (
                                <div key={m.id} className="rounded-lg border p-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon className={`h-4 w-4 ${movementColors[m.type]}`} />
                                            <span className="font-medium">{movementLabels[m.type]}</span>
                                            <span className={`font-bold tabular-nums ${m.type === 'ENTRY' || m.type === 'RETURN' ? 'text-green-600' : 'text-red-600'}`}>
                                                {m.type === 'ENTRY' || m.type === 'RETURN' ? '+' : '-'}{m.quantity}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                            {format(new Date(m.movementDate), "dd/MM HH:mm", { locale: es })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{m.reason}</p>
                                    {m.user && <p className="text-[10px] text-muted-foreground">por {m.user.firstName} {m.user.lastName}</p>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Artículo</DialogTitle>
                        <DialogDescription>Modifica la información del artículo.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Nombre</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción</Label>
                            <Input value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Costo unitario</Label>
                                <Input type="number" step="0.01" min="0" value={editForm.unitCost} onChange={(e) => setEditForm(f => ({ ...f, unitCost: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Estado</Label>
                                <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(statusLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isUpdating}>{isUpdating ? 'Guardando...' : 'Guardar cambios'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Movement Dialog */}
            <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Movimiento</DialogTitle>
                        <DialogDescription>Registra una entrada, salida, retorno o ajuste.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMovement} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={movForm.type} onValueChange={(v) => setMovForm(f => ({ ...f, type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ENTRY">Entrada</SelectItem>
                                        <SelectItem value="EXIT">Salida</SelectItem>
                                        <SelectItem value="RETURN">Retorno</SelectItem>
                                        <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Cantidad</Label>
                                <Input type="number" min="1" placeholder="10" value={movForm.quantity} onChange={(e) => setMovForm(f => ({ ...f, quantity: e.target.value }))} required />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Motivo</Label>
                            <Input placeholder="Evento institucional, ajuste de inventario..." value={movForm.reason} onChange={(e) => setMovForm(f => ({ ...f, reason: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Notas (opcional)</Label>
                            <Input placeholder="Notas adicionales" value={movForm.notes} onChange={(e) => setMovForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setMovementOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isAddingMovement}>
                                {isAddingMovement ? 'Registrando...' : 'Registrar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
