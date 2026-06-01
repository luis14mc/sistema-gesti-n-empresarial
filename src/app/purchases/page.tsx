'use client';

// ============================================
// PURCHASES PAGE — Solicitudes de Compra
// ============================================
// CRUD completo con workflow de aprobación:
// DRAFT → PENDING → APPROVED/REJECTED → ORDERED → RECEIVED

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
import { Textarea } from '@/components/ui/textarea';
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
    Plus, Search, Filter, Edit3, Trash2, Check, X, ShoppingCart,
    ArrowRight, Package,
} from 'lucide-react';
import { usePurchases, usePurchaseDetail } from '@/hooks/usePurchases';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/shared/Pagination';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { formatRelativeDate } from '@/utils/helpers';
import type { Role, PurchaseCategory, PurchasePriority, PurchaseStatus, PurchaseRequest } from '@/types';

// ============================================
// CONSTANTS
// ============================================

const statusColors: Record<string, string> = {
    DRAFT: 'bg-muted text-muted-foreground border-border',
    PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    APPROVED: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
    REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
    ORDERED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    RECEIVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    CANCELLED: 'bg-muted text-muted-foreground border-border line-through',
};

const statusLabels: Record<string, string> = {
    DRAFT: 'Borrador', PENDING: 'Pendiente', APPROVED: 'Aprobada',
    REJECTED: 'Rechazada', ORDERED: 'Ordenada', RECEIVED: 'Recibida', CANCELLED: 'Cancelada',
};

const categoryLabels: Record<string, string> = {
    COMPUTING_EQUIPMENT: 'Eq. Cómputo', OFFICE_SUPPLIES: 'Papelería',
    FURNITURE: 'Mobiliario', SOFTWARE_LICENSES: 'Licencias SW',
    SERVICES: 'Servicios', OTHER: 'Otro',
};

const priorityLabels: Record<string, string> = {
    LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente',
};

const priorityColors: Record<string, string> = {
    LOW: 'bg-muted text-muted-foreground',
    MEDIUM: 'bg-blue-500/10 text-blue-600',
    HIGH: 'bg-orange-500/10 text-orange-600',
    URGENT: 'bg-red-500/10 text-red-600',
};

// Workflow transitions
const nextStatus: Partial<Record<string, string[]>> = {
    DRAFT: ['PENDING', 'CANCELLED'],
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['ORDERED', 'CANCELLED'],
    ORDERED: ['RECEIVED'],
};

// ============================================
// PAGE
// ============================================

export default function PurchasesPage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);

    const {
        purchases,
        total,
        totalPages,
        isLoading,
        createPurchase,
        isCreating,
        deletePurchase
    } = usePurchases({
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? undefined : statusFilter as any,
        page,
        pageSize: 10
    });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
    const sheetOpen = selectedPurchaseId !== null;

    const role = (user?.role ?? 'USER') as Role;
    const canCreate = canAccess(role, 'purchases', 'create');
    const canDelete = canAccess(role, 'purchases', 'delete');

    const [form, setForm] = useState({
        title: '', description: '', justification: '', category: 'COMPUTING_EQUIPMENT',
        priority: 'MEDIUM', deliveryDate: '', comments: '',
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createPurchase({
                title: form.title,
                description: form.description,
                justification: form.justification,
                category: form.category as PurchaseCategory,
                priority: form.priority as PurchasePriority,
                deliveryDate: form.deliveryDate || undefined,
                comments: form.comments || undefined,
            } as any);
            sileo.success({ title: 'Solicitud creada', description: 'Se registró correctamente' });
            setDialogOpen(false);
            setForm({ title: '', description: '', justification: '', category: 'COMPUTING_EQUIPMENT', priority: 'MEDIUM', deliveryDate: '', comments: '' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo crear la solicitud' });
        }
    };

    const handleDeleteFromTable = async (p: PurchaseRequest) => {
        const result = await swalConfirm('¿Eliminar solicitud?', `"${p.title}" (${p.number})`, 'Sí, eliminar');
        if (!result.isConfirmed) return;
        try {
            await deletePurchase(p.id);
            sileo.success({ title: 'Solicitud eliminada' });
            if (selectedPurchaseId === p.id) setSelectedPurchaseId(null);
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Compras / Adquisiciones" description="Solicitudes de compra y su aprobación">
                    {canCreate && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="h-4 w-4 mr-2" /> Nueva Solicitud</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Nueva Solicitud de Compra</DialogTitle>
                                    <DialogDescription>Llena los datos para crear una solicitud.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Título *</Label>
                                        <Input placeholder="Compra de laptops para desarrollo" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Descripción *</Label>
                                        <Textarea placeholder="Describe qué se necesita comprar y sus especificaciones..." value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, description: e.target.value }))} required rows={3} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Justificación *</Label>
                                        <Textarea placeholder="Describe por qué se necesita esta compra..." value={form.justification} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, justification: e.target.value }))} required rows={3} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Categoría *</Label>
                                            <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(categoryLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Prioridad</Label>
                                            <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(priorityLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha de entrega deseada</Label>
                                        <Input type="date" value={form.deliveryDate} onChange={(e) => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Comentarios (opcional)</Label>
                                        <Textarea placeholder="Notas adicionales..." value={form.comments} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, comments: e.target.value }))} rows={2} />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isCreating}>{isCreating ? 'Creando...' : 'Crear Solicitud'}</Button>
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
                        <Input placeholder="Buscar por título o número..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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

                {/* Table */}
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Título</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="hidden md:table-cell">Solicitante</TableHead>
                                    <TableHead className="text-right">Total Est.</TableHead>
                                    {canDelete && <TableHead className="w-10" />}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : purchases.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            No se encontraron solicitudes
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    purchases.map((p) => (
                                        <TableRow
                                            key={p.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => setSelectedPurchaseId(p.id)}
                                        >
                                            <TableCell className="font-mono text-xs font-semibold">
                                                {p.number}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-muted rounded-md shrink-0">
                                                        <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </div>
                                                    <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs uppercase font-medium">{categoryLabels[p.category] || p.category}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusColors[p.status]}>
                                                    {statusLabels[p.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                                {p.requestedBy ? `${p.requestedBy.firstName} ${p.requestedBy.lastName}` : 'Sistema'}
                                            </TableCell>
                                            <TableCell className="text-right font-medium tabular-nums text-sm">
                                                {p.estimatedTotal ? `$${p.estimatedTotal.toLocaleString()}` : '—'}
                                            </TableCell>
                                            {canDelete && (
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteFromTable(p)}
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
            <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) setSelectedPurchaseId(null); }}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                    {selectedPurchaseId && (
                        <PurchaseDetailPanel
                            purchaseId={selectedPurchaseId}
                            role={role}
                            onClose={() => setSelectedPurchaseId(null)}
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

function PurchaseDetailPanel({ purchaseId, role, onClose }: { purchaseId: string; role: Role; onClose: () => void }) {
    const { purchase: p, isLoading, updatePurchase, isUpdating, deletePurchase, addItem, isAddingItem } = usePurchaseDetail(purchaseId);
    const canUpdate = canAccess(role, 'purchases', 'update');
    const canDelete = canAccess(role, 'purchases', 'delete');
    const [editing, setEditing] = useState(false);
    const [addingItem, setAddingItem] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', justification: '', category: '', priority: '', supplier: '', supplierContact: '', notes: '' });
    const [itemForm, setItemForm] = useState({ description: '', quantity: '', unitPrice: '', specifications: '' });

    if (isLoading || !p) {
        return (
            <div className="space-y-4 pt-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    const handleDelete = async () => {
        const result = await swalConfirm('¿Eliminar solicitud?', `"${p.title}" (${p.number})`, 'Sí, eliminar');
        if (!result.isConfirmed) return;
        try {
            await deletePurchase();
            sileo.success({ title: 'Solicitud eliminada' });
            onClose();
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    const handleStatusChange = async (newStatus: PurchaseStatus) => {
        try {
            await updatePurchase({ status: newStatus });
            sileo.success({ title: `Estado: ${statusLabels[newStatus]}` });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar' });
        }
    };

    const startEditing = () => {
        setEditForm({
            title: p.title, justification: p.justification, category: p.category,
            priority: p.priority, supplier: p.supplier || '', supplierContact: p.supplierContact || '',
            notes: p.notes || '',
        });
        setEditing(true);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updatePurchase({
                title: editForm.title, justification: editForm.justification,
                category: editForm.category as PurchaseCategory, priority: editForm.priority as PurchasePriority,
                supplier: editForm.supplier || undefined, supplierContact: editForm.supplierContact || undefined,
                notes: editForm.notes || undefined,
            });
            setEditing(false);
            sileo.success({ title: 'Solicitud actualizada' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar' });
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addItem({
                description: itemForm.description,
                quantity: parseInt(itemForm.quantity),
                unitPrice: itemForm.unitPrice ? parseFloat(itemForm.unitPrice) : undefined,
                specifications: itemForm.specifications || undefined,
            });
            setAddingItem(false);
            setItemForm({ description: '', quantity: '', unitPrice: '', specifications: '' });
            sileo.success({ title: 'Item agregado' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo agregar el item' });
        }
    };

    const actions = nextStatus[p.status] ?? [];
    const itemsTotal = p.items?.reduce((sum, i) => sum + (i.totalPrice || 0), 0) ?? 0;

    return (
        <div className="space-y-6 pt-2">
            <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs text-muted-foreground font-mono mb-1">{p.number}</p>
                        <SheetTitle className="text-lg font-heading leading-snug">{p.title}</SheetTitle>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        {canUpdate && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditing}><Edit3 className="h-4 w-4" /></Button>
                        )}
                        {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
                        )}
                    </div>
                </div>
            </SheetHeader>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={statusColors[p.status]}>{statusLabels[p.status]}</Badge>
                <Badge variant="outline" className={priorityColors[p.priority]}>{priorityLabels[p.priority]}</Badge>
                <Badge variant="outline">{categoryLabels[p.category]}</Badge>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Solicitante</p><p className="font-medium">{p.requestedBy?.firstName} {p.requestedBy?.lastName}</p></div>
                {p.approvedBy && <div><p className="text-xs text-muted-foreground">Aprobado por</p><p className="font-medium">{p.approvedBy.firstName} {p.approvedBy.lastName}</p></div>}
                {p.supplier && <div><p className="text-xs text-muted-foreground">Proveedor</p><p className="font-medium">{p.supplier}</p></div>}
                {p.supplierContact && <div><p className="text-xs text-muted-foreground">Contacto</p><p className="font-medium">{p.supplierContact}</p></div>}
                {p.estimatedTotal && <div><p className="text-xs text-muted-foreground">Total estimado</p><p className="font-medium text-lg">${p.estimatedTotal.toLocaleString()}</p></div>}
                {p.approvedBudget && <div><p className="text-xs text-muted-foreground">Presupuesto aprobado</p><p className="font-medium text-lg text-green-600">${p.approvedBudget.toLocaleString()}</p></div>}
                <div><p className="text-xs text-muted-foreground">Creada</p><p className="font-medium">{formatRelativeDate(p.createdAt)}</p></div>
            </div>

            {/* Justification */}
            <div>
                <p className="text-xs text-muted-foreground mb-1">Justificación</p>
                <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3">{p.justification}</p>
            </div>

            {p.rejectionReason && (
                <div className="bg-red-500/5 border border-red-200 dark:border-red-900 rounded-lg p-3">
                    <p className="text-xs text-red-600 font-semibold mb-1">Motivo de rechazo</p>
                    <p className="text-sm">{p.rejectionReason}</p>
                </div>
            )}

            {p.notes && (
                <div>
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm">{p.notes}</p>
                </div>
            )}

            <Separator />

            {/* Workflow buttons */}
            {canUpdate && actions.length > 0 && (
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Acciones</Label>
                    <div className="flex flex-wrap gap-2">
                        {actions.map(s => (
                            <Button key={s} variant="outline" size="sm" onClick={() => handleStatusChange(s as PurchaseStatus)} disabled={isUpdating}>
                                {s === 'APPROVED' && <Check className="h-3.5 w-3.5 mr-1.5" />}
                                {s === 'REJECTED' && <X className="h-3.5 w-3.5 mr-1.5" />}
                                {(s === 'ORDERED' || s === 'RECEIVED' || s === 'PENDING') && <ArrowRight className="h-3.5 w-3.5 mr-1.5" />}
                                {statusLabels[s]}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Items list */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Items ({p.items?.length ?? 0})</p>
                    {canUpdate && (
                        <Button variant="outline" size="sm" onClick={() => setAddingItem(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Item
                        </Button>
                    )}
                </div>

                {(!p.items || p.items.length === 0) ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">Sin items agregados</p>
                ) : (
                    <div className="space-y-2">
                        {p.items.map(item => (
                            <div key={item.id} className="rounded-lg border p-3 text-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-medium">{item.description}</p>
                                        {item.specifications && <p className="text-xs text-muted-foreground mt-0.5">{item.specifications}</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Cant: {item.quantity}</p>
                                        {item.unitPrice && <p className="text-xs font-medium">${item.unitPrice.toLocaleString()} c/u</p>}
                                        {item.totalPrice && <p className="text-sm font-bold tabular-nums">${item.totalPrice.toLocaleString()}</p>}
                                    </div>
                                </div>
                                {item.received && <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-600 text-[10px]">Recibido</Badge>}
                            </div>
                        ))}
                        {itemsTotal > 0 && (
                            <div className="text-right text-sm font-bold pt-1">
                                Total: ${itemsTotal.toLocaleString()}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar Solicitud</DialogTitle>
                        <DialogDescription>Modifica los datos de la solicitud.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Título</Label>
                            <Input value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Justificación</Label>
                            <Textarea value={editForm.justification} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(f => ({ ...f, justification: e.target.value }))} rows={3} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select value={editForm.category} onValueChange={(v) => setEditForm(f => ({ ...f, category: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(categoryLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Prioridad</Label>
                                <Select value={editForm.priority} onValueChange={(v) => setEditForm(f => ({ ...f, priority: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(priorityLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Proveedor</Label>
                                <Input value={editForm.supplier} onChange={(e) => setEditForm(f => ({ ...f, supplier: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Contacto</Label>
                                <Input value={editForm.supplierContact} onChange={(e) => setEditForm(f => ({ ...f, supplierContact: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notas</Label>
                            <Textarea value={editForm.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isUpdating}>{isUpdating ? 'Guardando...' : 'Guardar cambios'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Add Item Dialog */}
            <Dialog open={addingItem} onOpenChange={setAddingItem}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Agregar Item</DialogTitle>
                        <DialogDescription>Agrega un artículo o servicio a la solicitud.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddItem} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Descripción</Label>
                            <Input placeholder="Laptop Dell XPS 15" value={itemForm.description} onChange={(e) => setItemForm(f => ({ ...f, description: e.target.value }))} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Cantidad</Label>
                                <Input type="number" min="1" placeholder="5" value={itemForm.quantity} onChange={(e) => setItemForm(f => ({ ...f, quantity: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Precio unitario</Label>
                                <Input type="number" step="0.01" min="0" placeholder="25000.00" value={itemForm.unitPrice} onChange={(e) => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Especificaciones (opcional)</Label>
                            <Textarea placeholder="16GB RAM, 512GB SSD..." value={itemForm.specifications} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setItemForm(f => ({ ...f, specifications: e.target.value }))} rows={2} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddingItem(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isAddingItem}>{isAddingItem ? 'Agregando...' : 'Agregar Item'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
