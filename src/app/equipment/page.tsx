'use client';

// ============================================
// EQUIPMENT PAGE — Gestión completa de equipos
// ============================================
// CRUD: crear, ver detalle, editar, eliminar, cambiar estado

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
    Plus, Search, Filter, Edit3, Trash2, Monitor, Laptop,
    Printer, Phone, Tablet, HardDrive, Package, FileText, Printer as PrintIcon,
    History
} from 'lucide-react';
import Link from 'next/link';
import { useEquipment, useEquipmentDetail, useEquipmentStats } from '@/hooks/useEquipment';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/shared/Pagination';
import { AssignmentNoteContent } from '@/components/equipment/AssignmentNoteContent';
import { ReturnNoteContent } from '@/components/equipment/ReturnNoteContent';
import { EquipmentFileUpload } from '@/components/equipment/EquipmentFileUpload';
import { equipmentAssignmentsService } from '@/services/equipment-assignments.service';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { formatRelativeDate } from '@/utils/helpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import type { Role, EquipmentType, EquipmentStatus, Equipment } from '@/types';

// ============================================
// CONSTANTS
// ============================================

const statusColors: Record<string, string> = {
    AVAILABLE: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
    ASSIGNED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    IN_MAINTENANCE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    DAMAGED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
    RETIRED: 'bg-muted text-muted-foreground border-border',
    LOST: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900',
};

const statusLabels: Record<string, string> = {
    AVAILABLE: 'Disponible', ASSIGNED: 'Asignado', IN_MAINTENANCE: 'En Mantenimiento',
    DAMAGED: 'Dañado', RETIRED: 'Dado de baja', LOST: 'Extraviado',
};

/** Estados seleccionables desde UI (excluye RETIRED/DISPOSED — solo via disposal workflow). */
const selectableStatuses = ['AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'LOST'] as const;

const typeLabels: Record<string, string> = {
    LAPTOP: 'Laptop',
    DESKTOP_PC: 'PC de escritorio',
    DESKTOP: 'PC de escritorio',
    MONITOR: 'Monitor',
    PRINTER: 'Impresora',
    PHONE: 'Teléfono',
    UPS: 'UPS',
    ACCESSORY: 'Accesorio',
    OTHER: 'Otro',
};

const typeIcons: Record<string, typeof Monitor> = {
    LAPTOP: Laptop,
    DESKTOP_PC: Monitor,
    DESKTOP: Monitor,
    MONITOR: Monitor,
    PRINTER: Printer,
    PHONE: Phone,
    UPS: Package,
    ACCESSORY: HardDrive,
    OTHER: Package,
};

const EMPTY_EQUIPMENT_FORM = {
    type: 'LAPTOP',
    inventoryCode: '',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    ram: '',
    processor: '',
    storage: '',
    os: '',
    notes: '',
};

function isComputerType(type: string) {
    return ['LAPTOP', 'DESKTOP', 'DESKTOP_PC'].includes(type);
}

// ============================================
// PAGE
// ============================================

export default function EquipmentPage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);

    const {
        equipment,
        total,
        totalPages,
        isLoading,
        createEquipment,
        isCreating,
        deleteEquipment,
        isDeleting
    } = useEquipment({
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? undefined : statusFilter as any,
        type: typeFilter === 'ALL' ? undefined : typeFilter as any,
        page,
        pageSize: 10
    });
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
    const sheetOpen = selectedEquipmentId !== null;

    const role = (user?.role ?? 'USER') as Role;
    const canCreate = canAccess(role, 'equipment', 'create');
    const canDelete = canAccess(role, 'equipment', 'delete');
    const { stats, isLoading: statsLoading } = useEquipmentStats();

    const [form, setForm] = useState({ ...EMPTY_EQUIPMENT_FORM });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const isComputer = isComputerType(form.type);
        try {
            await createEquipment({
                type: form.type as EquipmentType,
                category: form.type,
                inventoryCode: form.inventoryCode.trim() || undefined,
                assetCode: form.inventoryCode.trim() || undefined,
                brand: form.brand,
                model: form.model,
                serialNumber: form.serialNumber || undefined,
                purchaseDate: form.purchaseDate || undefined,
                ram: isComputer ? form.ram || undefined : undefined,
                processor: isComputer ? form.processor || undefined : undefined,
                storage: isComputer ? form.storage || undefined : undefined,
                os: isComputer ? form.os || undefined : undefined,
                notes: !isComputer ? form.notes || undefined : undefined,
            } as any);
            sileo.success({ title: 'Equipo creado', description: 'Se registró correctamente' });
            setDialogOpen(false);
            setForm({ ...EMPTY_EQUIPMENT_FORM });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo crear el equipo' });
        }
    };

    const handleDeleteFromTable = async (eq: Equipment) => {
        const result = await swalConfirm('¿Eliminar equipo?', `"${eq.name}" (${eq.code})`, 'Sí, eliminar');
        if (!result.isConfirmed) return;
        try {
            await deleteEquipment(eq.id);
            sileo.success({ title: 'Equipo eliminado' });
            if (selectedEquipmentId === eq.id) setSelectedEquipmentId(null);
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Equipos IT" description="Inventario y gestión de equipos informáticos">
                    {canCreate && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Equipo</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Nuevo Equipo</DialogTitle>
                                    <DialogDescription>Registra un nuevo equipo en el inventario.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Tipo *</Label>
                                            <Select
                                                value={form.type}
                                                onValueChange={(v) => setForm((f) => ({
                                                    ...f,
                                                    type: v,
                                                    ram: '', processor: '', storage: '', os: '', notes: '',
                                                }))}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(typeLabels).filter(([k]) => k !== 'DESKTOP').map(([k, v]) => (
                                                        <SelectItem key={k} value={k}>{v}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Número de inventario</Label>
                                            <Input
                                                placeholder="Ej: TI-LAP-0005 (auto si vacío)"
                                                value={form.inventoryCode}
                                                onChange={(e) => setForm((f) => ({ ...f, inventoryCode: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Marca *</Label>
                                            <Input placeholder="Apple, Dell, HP..." value={form.brand} onChange={(e) => setForm(f => ({ ...f, brand: e.target.value }))} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Modelo *</Label>
                                            <Input placeholder="Latitude 5440" value={form.model} onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))} required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Número de serie</Label>
                                            <Input placeholder="SN123456789" value={form.serialNumber} onChange={(e) => setForm(f => ({ ...f, serialNumber: e.target.value }))} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Fecha de compra</Label>
                                            <Input type="date" value={form.purchaseDate} onChange={(e) => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
                                        </div>
                                    </div>

                                    {isComputerType(form.type) ? (
                                        <>
                                            <Separator />
                                            <p className="text-xs text-muted-foreground font-medium">Especificaciones del equipo</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label>Procesador</Label>
                                                    <Input placeholder="Intel i7 / Apple M3" value={form.processor} onChange={(e) => setForm(f => ({ ...f, processor: e.target.value }))} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>RAM</Label>
                                                    <Input placeholder="16 GB" value={form.ram} onChange={(e) => setForm(f => ({ ...f, ram: e.target.value }))} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label>Almacenamiento</Label>
                                                    <Input placeholder="512 GB SSD" value={form.storage} onChange={(e) => setForm(f => ({ ...f, storage: e.target.value }))} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Sistema operativo</Label>
                                                    <Input placeholder="Windows 11 / macOS" value={form.os} onChange={(e) => setForm(f => ({ ...f, os: e.target.value }))} />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>Comentarios / detalles</Label>
                                            <Textarea
                                                placeholder="Describe características relevantes: resolución, conectividad, accesorios incluidos, ubicación, etc."
                                                rows={4}
                                                value={form.notes}
                                                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                            />
                                        </div>
                                    )}
                                    <DialogFooter>
                                        <Button type="submit" disabled={isCreating}>{isCreating ? 'Creando...' : 'Crear Equipo'}</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </PageHeader>

                {/* Dashboard stats */}
                {statsLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                    </div>
                ) : stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {[
                            { label: 'Total', value: stats.total },
                            { label: 'Disponibles', value: stats.available },
                            { label: 'Asignados', value: stats.assigned },
                            { label: 'Mantenimiento', value: stats.inMaintenance },
                            { label: 'Dañados', value: stats.damaged },
                            { label: 'Sin serie', value: stats.withoutSerial },
                        ].map((item) => (
                            <Card key={item.label} className="border-border/60">
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">{item.label}</p>
                                    <p className="text-2xl font-semibold mt-1">{item.value}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por nombre, código o serie..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            {Object.entries(typeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Equipo</TableHead>
                                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                                    <TableHead className="hidden md:table-cell">Serie</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="hidden md:table-cell">Asignado a</TableHead>
                                    <TableHead className="hidden lg:table-cell">Departamento</TableHead>
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
                                ) : equipment.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            No se encontraron equipos
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    equipment.map((eq) => (
                                        <TableRow
                                            key={eq.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => setSelectedEquipmentId(eq.id)}
                                        >
                                            <TableCell className="font-mono text-xs font-semibold">
                                                {eq.code}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-muted rounded-md shrink-0">
                                                        {(() => {
                                                            const Icon = typeIcons[eq.type] || Package;
                                                            return <Icon className="h-3.5 w-3.5" />;
                                                        })()}
                                                    </div>
                                                    <p className="text-sm font-medium line-clamp-1">{eq.name}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <span className="text-xs">{typeLabels[eq.type] || eq.categoryLabel}</span>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell font-mono text-xs">
                                                {eq.serialNumber || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusColors[eq.status]}>
                                                    {statusLabels[eq.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm">
                                                {(eq as Equipment & { assignedTo?: string }).assignedTo ?? '—'}
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                                {(eq as Equipment & { assignedDepartment?: string }).assignedDepartment ?? '—'}
                                            </TableCell>
                                            {canDelete && (
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteFromTable(eq)}
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
            <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) setSelectedEquipmentId(null); }}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                    {selectedEquipmentId && (
                        <EquipmentDetailPanel
                            equipmentId={selectedEquipmentId}
                            role={role}
                            onClose={() => setSelectedEquipmentId(null)}
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

function EquipmentDetailPanel({ equipmentId, role, onClose }: { equipmentId: string; role: Role; onClose: () => void }) {
    const { equipment: eq, isLoading, updateEquipment, isUpdating, deleteEquipment, isDeleting, addMaintenance, isAddingMaintenance, refetch } = useEquipmentDetail(equipmentId);
    const canUpdate = canAccess(role, 'equipment', 'update');
    const canDelete = canAccess(role, 'equipment', 'delete');
    const [editing, setEditing] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
    const [returnPreviewAssignment, setReturnPreviewAssignment] = useState<any>(null);
    const [maintenanceOpen, setMaintenanceOpen] = useState(false);
    const [maintenanceForm, setMaintenanceForm] = useState({
        type: 'CORRECTIVE', description: '', scheduledDate: '', technician: '',
    });
    const [editForm, setEditForm] = useState({
        inventoryCode: '', type: '', brand: '', model: '', serialNumber: '',
        description: '', status: '',
        ram: '', processor: '', storage: '', os: '', notes: '',
    });

    const handleAttachDocument = async (assignmentId: string, documentType: 'delivery' | 'return', url: string) => {
        await equipmentAssignmentsService.attachDocument(assignmentId, documentType, url);
        await refetch();
        sileo.success({ title: 'Documento vinculado a la asignación' });
    };

    const handleAddMaintenance = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addMaintenance({
                equipmentId,
                type: maintenanceForm.type,
                description: maintenanceForm.description,
                scheduledDate: maintenanceForm.scheduledDate || undefined,
            });
            sileo.success({ title: 'Mantenimiento registrado' });
            setMaintenanceOpen(false);
            setMaintenanceForm({ type: 'CORRECTIVE', description: '', scheduledDate: '', technician: '' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo registrar el mantenimiento' });
        }
    };

    if (isLoading || !eq) {
        return (
            <div className="space-y-4 pt-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    const TypeIcon = typeIcons[eq.type] ?? Package;

    const handleDelete = async () => {
        const result = await swalConfirm('¿Eliminar equipo?', `"${eq.name}" (${eq.code})`, 'Sí, eliminar');
        if (!result.isConfirmed) return;
        try {
            await deleteEquipment();
            sileo.success({ title: 'Equipo eliminado' });
            onClose();
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    const handleStatusChange = async (newStatus: EquipmentStatus) => {
        try {
            await updateEquipment({ status: newStatus });
            sileo.success({ title: `Estado: ${statusLabels[newStatus]}` });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar el estado' });
        }
    };

    const startEditing = () => {
        setEditForm({
            inventoryCode: eq.code || eq.inventoryCode,
            type: eq.type,
            brand: eq.brand || '',
            model: eq.model || '',
            serialNumber: eq.serialNumber || '',
            description: eq.description || '',
            status: eq.status,
            ram: eq.ram || '',
            processor: eq.processor || '',
            storage: eq.storage || '',
            os: eq.os || '',
            notes: eq.notes || eq.description || '',
        });
        setEditing(true);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        const isComputer = isComputerType(editForm.type);
        try {
            await updateEquipment({
                type: editForm.type as EquipmentType,
                brand: editForm.brand || undefined,
                model: editForm.model || undefined,
                serialNumber: editForm.serialNumber || undefined,
                status: editForm.status as EquipmentStatus,
                ram: isComputer ? editForm.ram || undefined : null,
                processor: isComputer ? editForm.processor || undefined : null,
                storage: isComputer ? editForm.storage || undefined : null,
                os: isComputer ? editForm.os || undefined : null,
                notes: !isComputer ? editForm.notes || undefined : undefined,
            } as any);
            setEditing(false);
            sileo.success({ title: 'Equipo actualizado' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar' });
        }
    };

    return (
        <div className="space-y-6 pt-2">
            <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <TypeIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-mono">{eq.code}</p>
                            <SheetTitle className="text-lg font-heading leading-snug">{eq.name}</SheetTitle>
                        </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            asChild
                        >
                            <Link href={`/admin/audit-logs?entityId=${equipmentId}`}>
                                <History className="h-4 w-4" />
                            </Link>
                        </Button>
                        {canUpdate && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditing}><Edit3 className="h-4 w-4" /></Button>
                        )}
                        {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete} disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                        )}
                    </div>
                </div>
            </SheetHeader>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={statusColors[eq.status]}>{statusLabels[eq.status]}</Badge>
                <Badge variant="outline">{typeLabels[eq.type]}</Badge>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                {eq.brand && <div><p className="text-xs text-muted-foreground">Marca</p><p className="font-medium">{eq.brand}</p></div>}
                {eq.model && <div><p className="text-xs text-muted-foreground">Modelo</p><p className="font-medium">{eq.model}</p></div>}
                {eq.serialNumber && <div><p className="text-xs text-muted-foreground">Número de serie</p><p className="font-medium font-mono">{eq.serialNumber}</p></div>}
                {eq.purchaseDate && <div><p className="text-xs text-muted-foreground">Fecha de compra</p><p className="font-medium">{format(new Date(eq.purchaseDate), "dd/MM/yyyy", { locale: es })}</p></div>}
                {eq.purchaseCost && <div><p className="text-xs text-muted-foreground">Costo</p><p className="font-medium">${eq.purchaseCost.toLocaleString()}</p></div>}
                <div><p className="text-xs text-muted-foreground">Registrado</p><p className="font-medium">{formatRelativeDate(eq.createdAt)}</p></div>
            </div>

            {eq.description && !isComputerType(eq.type) && (
                <div>
                    <p className="text-xs text-muted-foreground mb-1">Comentarios / detalles</p>
                    <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{eq.description}</p>
                </div>
            )}

            {isComputerType(eq.type) && (eq.processor || eq.ram || eq.storage || eq.os) && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                    {eq.processor && <div><p className="text-xs text-muted-foreground">Procesador</p><p className="font-medium">{eq.processor}</p></div>}
                    {eq.ram && <div><p className="text-xs text-muted-foreground">RAM</p><p className="font-medium">{eq.ram}</p></div>}
                    {eq.storage && <div><p className="text-xs text-muted-foreground">Almacenamiento</p><p className="font-medium">{eq.storage}</p></div>}
                    {eq.os && <div><p className="text-xs text-muted-foreground">Sistema operativo</p><p className="font-medium">{eq.os}</p></div>}
                </div>
            )}

            <Separator />

            {/* Change status + maintenance */}
            {canUpdate && (
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Cambiar estado</Label>
                        <Select value={eq.status} onValueChange={(v) => handleStatusChange(v as EquipmentStatus)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {selectableStatuses.map((k) => (<SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setMaintenanceOpen(true)}>
                        Registrar mantenimiento
                    </Button>
                </div>
            )}

            {/* Active assignments */}
            {eq.assignments && eq.assignments.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold">Asignaciones</p>
                    <div className="space-y-2">
                        {eq.assignments.map(a => (
                            <div key={a.id} className="rounded-lg border p-3 text-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium">
                                            {a.employeeNameAtTime || a.assigneeName ||
                                                (a.user ? `${a.user.firstName} ${a.user.lastName}` : '—')}
                                        </p>
                                        {(a.departmentAtTime || a.positionAtTime) && (
                                            <p className="text-xs text-muted-foreground">
                                                {a.departmentAtTime}{a.positionAtTime ? ` · ${a.positionAtTime}` : ''}
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(a.assignedDate), "dd/MM/yyyy", { locale: es })}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge variant="outline" className={a.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : ''}>
                                            {a.status === 'ACTIVE' ? 'Activa' : a.status === 'RETURNED' ? 'Devuelta' : 'Cancelada'}
                                        </Badge>
                                        {a.status === 'ACTIVE' && (
                                            <div className="flex flex-col items-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-[10px] px-2"
                                                    onClick={() => setSelectedAssignment(a)}
                                                >
                                                    <FileText className="h-3 w-3 mr-1" />
                                                    Acta entrega
                                                </Button>
                                                <EquipmentFileUpload
                                                    tipoDocumento="ACTA_ASIGNACION"
                                                    label=""
                                                    currentUrl={a.deliveryDocumentUrl || a.urlNotaPdf}
                                                    onUploaded={(url) => handleAttachDocument(a.id, 'delivery', url)}
                                                />
                                            </div>
                                        )}
                                        {a.status !== 'ACTIVE' && (a.returnDocumentUrl || a.status === 'RETURNED' || a.status === 'REPLACED') && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[10px] px-2"
                                                onClick={() => setReturnPreviewAssignment(a)}
                                            >
                                                <FileText className="h-3 w-3 mr-1" />
                                                Acta devolución
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Assignment Note Modal */}
            <Dialog open={!!selectedAssignment} onOpenChange={(open) => !open && setSelectedAssignment(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Previsualización de Acta de Entrega</DialogTitle>
                        <DialogDescription>
                            Verifica la información antes de imprimir. El documento se ajustará automáticamente al tamaño de papel.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="border rounded-xl bg-muted/20 p-4 overflow-hidden">
                        <div id="assignment-note-print" className="bg-white">
                            {selectedAssignment && (
                                <AssignmentNoteContent
                                    equipment={eq as Equipment}
                                    assignment={selectedAssignment}
                                />
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setSelectedAssignment(null)}>
                            Cerrar
                        </Button>
                        <Button onClick={() => setTimeout(() => window.print(), 100)}>
                            <PrintIcon className="h-4 w-4 mr-2" />
                            Imprimir / Guardar PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Return note preview */}
            <Dialog open={!!returnPreviewAssignment} onOpenChange={(open) => !open && setReturnPreviewAssignment(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Acta de Devolución</DialogTitle>
                    </DialogHeader>
                    <div className="border rounded-xl bg-muted/20 p-4">
                        <div id="return-note-print" className="bg-white">
                            {returnPreviewAssignment && (
                                <ReturnNoteContent equipment={eq as Equipment} assignment={returnPreviewAssignment} />
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReturnPreviewAssignment(null)}>Cerrar</Button>
                        <Button onClick={() => setTimeout(() => window.print(), 100)}>
                            <PrintIcon className="h-4 w-4 mr-2" /> Imprimir / PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Maintenance dialog */}
            <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar mantenimiento</DialogTitle>
                        <DialogDescription>El equipo pasará a estado En mantenimiento.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddMaintenance} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={maintenanceForm.type} onValueChange={(v) => setMaintenanceForm((f) => ({ ...f, type: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PREVENTIVE">Preventivo</SelectItem>
                                    <SelectItem value="CORRECTIVE">Correctivo</SelectItem>
                                    <SelectItem value="UPDATE">Actualización</SelectItem>
                                    <SelectItem value="INSPECTION">Inspección</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción *</Label>
                            <Input
                                required
                                value={maintenanceForm.description}
                                onChange={(e) => setMaintenanceForm((f) => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fecha programada</Label>
                            <Input
                                type="date"
                                value={maintenanceForm.scheduledDate}
                                onChange={(e) => setMaintenanceForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setMaintenanceOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isAddingMaintenance}>
                                {isAddingMaintenance ? 'Guardando...' : 'Registrar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Historial del activo */}
            {eq.history && eq.history.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold">Historial del activo</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {eq.history.map((h) => (
                            <div key={h.id} className="rounded-lg border p-3 text-sm">
                                <div className="flex justify-between gap-2">
                                    <p className="font-medium">{h.title}</p>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {format(new Date(h.createdAt), 'dd/MM/yyyy', { locale: es })}
                                    </span>
                                </div>
                                {h.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{h.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Maintenances */}
            {eq.maintenances && eq.maintenances.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold">Mantenimientos</p>
                    <div className="space-y-2">
                        {eq.maintenances.map(m => (
                            <div key={m.id} className="rounded-lg border p-3 text-sm">
                                <div className="flex justify-between">
                                    <p className="font-medium capitalize">{m.type.toLowerCase()}</p>
                                    <Badge variant="outline">{m.status}</Badge>
                                </div>
                                <p className="text-xs mt-1">{m.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {m.scheduledDate
                                        ? `Programado: ${format(new Date(m.scheduledDate), 'dd/MM/yyyy', { locale: es })}`
                                        : 'Sin fecha programada'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar Equipo</DialogTitle>
                        <DialogDescription>Modifica la información del equipo.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Número de inventario</Label>
                            <Input value={editForm.inventoryCode} disabled className="font-mono bg-muted" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select
                                    value={editForm.type}
                                    onValueChange={(v) => setEditForm((f) => ({
                                        ...f,
                                        type: v,
                                        ram: '', processor: '', storage: '', os: '', notes: '',
                                    }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(typeLabels).filter(([k]) => k !== 'DESKTOP').map(([k, v]) => (
                                            <SelectItem key={k} value={k}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Marca</Label>
                                <Input value={editForm.brand} onChange={(e) => setEditForm(f => ({ ...f, brand: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Modelo</Label>
                                <Input value={editForm.model} onChange={(e) => setEditForm(f => ({ ...f, model: e.target.value }))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Número de serie</Label>
                            <Input value={editForm.serialNumber} onChange={(e) => setEditForm(f => ({ ...f, serialNumber: e.target.value }))} />
                        </div>

                        {isComputerType(editForm.type) ? (
                            <>
                                <Separator />
                                <p className="text-xs text-muted-foreground font-medium">Especificaciones</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Procesador</Label>
                                        <Input value={editForm.processor} onChange={(e) => setEditForm(f => ({ ...f, processor: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>RAM</Label>
                                        <Input value={editForm.ram} onChange={(e) => setEditForm(f => ({ ...f, ram: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label>Almacenamiento</Label>
                                        <Input value={editForm.storage} onChange={(e) => setEditForm(f => ({ ...f, storage: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sistema operativo</Label>
                                        <Input value={editForm.os} onChange={(e) => setEditForm(f => ({ ...f, os: e.target.value }))} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Label>Comentarios / detalles</Label>
                                <Textarea
                                    rows={4}
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                                />
                            </div>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isUpdating}>{isUpdating ? 'Guardando...' : 'Guardar cambios'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
