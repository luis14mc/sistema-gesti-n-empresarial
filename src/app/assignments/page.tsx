'use client';

// ============================================
// ASSIGNMENTS PAGE — Asignaciones de equipos
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
import { Plus, Search, Filter, RotateCcw } from 'lucide-react';
import { useAssignments } from '@/hooks/useAssignments';
import { useEquipment } from '@/hooks/useEquipment';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { formatDate } from '@/utils/helpers';
import type { Role, EquipmentAssignment } from '@/types';

// ============================================
// STATUS CONFIG
// ============================================

const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
    RETURNED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    CANCELLED: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
    ACTIVE: 'Activa', RETURNED: 'Devuelto', CANCELLED: 'Cancelada',
};

// Condiciones disponibles para devolución
const returnConditions = [
    { value: 'BUENO', label: 'Bueno - Sin daños' },
    { value: 'BUENO_CON_DETALLES', label: 'Bueno con detalles menores' },
    { value: 'REGULAR', label: 'Regular - Desgaste normal' },
    { value: 'DANADO', label: 'Dañado - Requiere reparación' },
    { value: 'IRREPARABLE', label: 'Irreparable - Dar de baja' },
];

// ============================================
// PAGE
// ============================================

export default function AssignmentsPage() {
    const { user } = useAuth();
    const { assignments, isLoading, createAssignment, isCreating, returnAssignment, isReturning } = useAssignments();
    const { equipment } = useEquipment();
    const { users } = useUsers();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [returnDialogOpen, setReturnDialogOpen] = useState(false);
    const [returningAssignment, setReturningAssignment] = useState<EquipmentAssignment | null>(null);
    const [returnForm, setReturnForm] = useState({ returnCondition: 'BUENO', notes: '' });

    const role = (user?.role ?? 'USER') as Role;
    const canCreate = canAccess(role, 'assignments', 'create');

    // Available equipment (not assigned)
    const availableEquipment = (equipment ?? []).filter(
        (e) => e.status === 'AVAILABLE'
    );

    const filtered = assignments.filter((a: EquipmentAssignment) => {
        const name = a.user ? `${a.user.firstName} ${a.user.lastName}` : '';
        const eqName = a.equipment?.name ?? '';
        const matchSearch =
            name.toLowerCase().includes(search.toLowerCase()) ||
            eqName.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
        return matchSearch && matchStatus;
    });

    // Create form
    const [form, setForm] = useState({ equipmentId: '', userId: '', condition: '', notes: '' });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        createAssignment(
            {
                equipmentId: form.equipmentId,
                userId: form.userId,
                condition: form.condition || undefined,
                notes: form.notes || undefined,
            },
            {
                onSuccess: () => {
                    sileo.success({ title: 'Asignación creada' });
                    setDialogOpen(false);
                    setForm({ equipmentId: '', userId: '', condition: '', notes: '' });
                },
                onError: () => sileo.error({ title: 'Error', description: 'No se pudo crear la asignación' }),
            }
        );
    };

    // Abrir dialog de devolución
    const openReturnDialog = (assignment: EquipmentAssignment) => {
        setReturningAssignment(assignment);
        setReturnForm({ returnCondition: 'BUENO', notes: '' });
        setReturnDialogOpen(true);
    };

    // Confirmar devolución con condición real
    const handleConfirmReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!returningAssignment) return;

        returnAssignment(
            {
                id: returningAssignment.id,
                data: {
                    returnCondition: returnForm.returnCondition,
                    notes: returnForm.notes || undefined,
                },
            },
            {
                onSuccess: () => {
                    sileo.success({ title: 'Devolución registrada', description: `Condición: ${returnConditions.find(c => c.value === returnForm.returnCondition)?.label}` });
                    setReturnDialogOpen(false);
                    setReturningAssignment(null);
                },
                onError: () => sileo.error({ title: 'Error', description: 'No se pudo registrar la devolución' }),
            }
        );
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Asignaciones de Equipos" description="Control de equipos asignados a usuarios">
                    {canCreate && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="h-4 w-4 mr-2" /> Nueva Asignación</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Nueva Asignación</DialogTitle>
                                    <DialogDescription>Asigna un equipo disponible a un usuario.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Equipo</Label>
                                        <Select value={form.equipmentId} onValueChange={(v) => setForm(f => ({ ...f, equipmentId: v }))}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona un equipo" /></SelectTrigger>
                                            <SelectContent>
                                                {availableEquipment.length === 0 ? (
                                                    <SelectItem value="none" disabled>No hay equipos disponibles</SelectItem>
                                                ) : (
                                                    availableEquipment.map((eq) => (
                                                        <SelectItem key={eq.id} value={eq.id}>
                                                            {eq.code} — {eq.name}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Usuario</Label>
                                        <Select value={form.userId} onValueChange={(v) => setForm(f => ({ ...f, userId: v }))}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                                            <SelectContent>
                                                {users.map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.firstName} {u.lastName} ({u.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Condición del equipo</Label>
                                        <Input placeholder="Ej: Bueno, con cargador" value={form.condition} onChange={(e) => setForm(f => ({ ...f, condition: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Notas</Label>
                                        <Input placeholder="Notas opcionales" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isCreating || !form.equipmentId || !form.userId}>
                                            {isCreating ? 'Asignando...' : 'Crear Asignación'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </PageHeader>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por usuario o equipo..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-44">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            {Object.entries(statusLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                ) : filtered.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">No se encontraron asignaciones</CardContent></Card>
                ) : (
                    <Card>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Equipo</TableHead>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="hidden md:table-cell">Fecha Asig.</TableHead>
                                        <TableHead className="hidden lg:table-cell">Condición</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((assignment: EquipmentAssignment) => (
                                        <TableRow key={assignment.id} className="hover:bg-muted/50">
                                            <TableCell>
                                                <p className="text-sm font-medium">{assignment.equipment?.name ?? '—'}</p>
                                                <p className="text-xs text-muted-foreground">{assignment.equipment?.code ?? ''}</p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-sm">
                                                    {assignment.user
                                                        ? `${assignment.user.firstName} ${assignment.user.lastName}`
                                                        : '—'}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusColors[assignment.status]}>
                                                    {statusLabels[assignment.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                                {formatDate(assignment.assignedDate)}
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                                {assignment.condition ?? '—'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {assignment.status === 'ACTIVE' && canCreate && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openReturnDialog(assignment)}
                                                        disabled={isReturning}
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-1" />
                                                        Devolver
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}
            </div>

            {/* Dialog de Devolución con condición real */}
            <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Devolución</DialogTitle>
                        <DialogDescription>
                            Equipo: <strong>{returningAssignment?.equipment?.name ?? '—'}</strong>
                            <br />
                            Usuario: <strong>{returningAssignment?.user?.firstName} {returningAssignment?.user?.lastName}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConfirmReturn} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Condición de devolución</Label>
                            <Select
                                value={returnForm.returnCondition}
                                onValueChange={(v) => setReturnForm(f => ({ ...f, returnCondition: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona condición" />
                                </SelectTrigger>
                                <SelectContent>
                                    {returnConditions.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Observaciones</Label>
                            <Input
                                placeholder="Detalles adicionales sobre la devolución..."
                                value={returnForm.notes}
                                onChange={(e) => setReturnForm(f => ({ ...f, notes: e.target.value }))}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setReturnDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isReturning}>
                                {isReturning ? 'Procesando...' : 'Confirmar Devolución'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
