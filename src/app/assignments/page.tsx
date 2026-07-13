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
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, Filter, RotateCcw, ArrowLeftRight, FileText, Printer } from 'lucide-react';
import { useAssignments } from '@/hooks/useAssignments';
import { useEquipment } from '@/hooks/useEquipment';
import { useEmployees } from '@/hooks/useEmployees';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import { formatDate } from '@/utils/helpers';
import { ReturnNoteContent } from '@/components/equipment/ReturnNoteContent';
import { EquipmentFileUpload } from '@/components/equipment/EquipmentFileUpload';
import type { Role, EquipmentAssignment, EquipmentStatus } from '@/types';

const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
    RETURNED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    REPLACED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    CANCELLED: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
    ACTIVE: 'Activa',
    RETURNED: 'Devuelto',
    REPLACED: 'Reemplazado',
    CANCELLED: 'Cancelada',
};

const deliveryReasons = [
    'Nuevo ingreso',
    'Reemplazo de equipo',
    'Cambio de puesto',
    'Préstamo temporal',
    'Renovación tecnológica',
    'Otro',
];

const returnReasons = [
    'Cambio de equipo',
    'Fin de contrato',
    'Cambio de puesto',
    'Daño',
    'Mantenimiento',
    'Baja del activo',
    'Otro',
];

const returnConditions = [
    { value: 'BUENO', label: 'Bueno - Disponible', statusAfter: 'AVAILABLE' as EquipmentStatus },
    { value: 'MANTENIMIENTO', label: 'Requiere mantenimiento', statusAfter: 'IN_MAINTENANCE' as EquipmentStatus },
    { value: 'DANADO', label: 'Dañado', statusAfter: 'DAMAGED' as EquipmentStatus },
    { value: 'IRREPARABLE', label: 'Irreparable - Dar de baja', statusAfter: 'RETIRED' as EquipmentStatus },
];

function getAssigneeName(a: EquipmentAssignment) {
    return (
        a.assigneeName ||
        a.employeeNameAtTime ||
        (a.employee?.fullName) ||
        (a.user ? `${a.user.firstName} ${a.user.lastName}` : '—')
    );
}

export default function AssignmentsPage() {
    const { user } = useAuth();
    const { assignments, isLoading, createAssignment, isCreating, returnAssignment, isReturning, swapEquipment, isSwapping, attachDocument } = useAssignments();
    const { equipment } = useEquipment({ pageSize: 200 });
    const { employees } = useEmployees({ isActive: true, pageSize: 200 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [returnDialogOpen, setReturnDialogOpen] = useState(false);
    const [swapDialogOpen, setSwapDialogOpen] = useState(false);
    const [returnNoteOpen, setReturnNoteOpen] = useState(false);
    const [returnedForNote, setReturnedForNote] = useState<EquipmentAssignment | null>(null);
    const [returningAssignment, setReturningAssignment] = useState<EquipmentAssignment | null>(null);
    const [returnForm, setReturnForm] = useState({
        returnCondition: 'BUENO',
        returnReason: '',
        notes: '',
        accessoriesReturned: '',
    });

    const role = (user?.role ?? 'USER') as Role;
    const canCreate = canAccess(role, 'assignments', 'create');

    const availableEquipment = (equipment ?? []).filter((e) => e.status === 'AVAILABLE');

    const filtered = assignments.filter((a: EquipmentAssignment) => {
        const name = getAssigneeName(a);
        const eqName = a.equipment?.name ?? '';
        const matchSearch =
            name.toLowerCase().includes(search.toLowerCase()) ||
            eqName.toLowerCase().includes(search.toLowerCase()) ||
            (a.equipment?.code ?? '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const [form, setForm] = useState({
        equipmentId: '',
        employeeId: '',
        deliveryReason: '',
        condition: '',
        accessories: '',
        notes: '',
    });

    const [swapForm, setSwapForm] = useState({
        oldAssignmentId: '',
        newEquipmentId: '',
        returnReason: 'Cambio de equipo',
        returnCondition: 'BUENO',
        assignmentNotes: '',
    });

    const selectedEmployee = employees.find((e) => e.id === form.employeeId);
    const activeAssignments = assignments.filter((a) => a.status === 'ACTIVE');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        createAssignment(
            {
                equipmentId: form.equipmentId,
                employeeId: form.employeeId,
                deliveryReason: form.deliveryReason || undefined,
                condition: form.condition || undefined,
                accessories: form.accessories || undefined,
                assignmentNotes: form.notes || undefined,
            },
            {
                onSuccess: () => {
                    sileo.success({ title: 'Asignación creada' });
                    setDialogOpen(false);
                    setForm({ equipmentId: '', employeeId: '', deliveryReason: '', condition: '', accessories: '', notes: '' });
                },
                onError: () => sileo.error({ title: 'Error', description: 'No se pudo crear la asignación' }),
            }
        );
    };

    const openReturnDialog = (assignment: EquipmentAssignment) => {
        setReturningAssignment(assignment);
        setReturnForm({ returnCondition: 'BUENO', returnReason: '', notes: '', accessoriesReturned: '' });
        setReturnDialogOpen(true);
    };

    const handleConfirmReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!returningAssignment) return;

        const conditionMeta = returnConditions.find((c) => c.value === returnForm.returnCondition);

        returnAssignment(
            {
                id: returningAssignment.id,
                data: {
                    returnCondition: returnForm.returnCondition,
                    returnReason: returnForm.returnReason || undefined,
                    returnNotes: returnForm.notes || undefined,
                    accessoriesReturned: returnForm.accessoriesReturned || undefined,
                    equipmentStatusAfter: conditionMeta?.statusAfter,
                },
            },
            {
                onSuccess: () => {
                    sileo.success({
                        title: 'Devolución registrada',
                        description: conditionMeta?.label,
                    });
                    setReturnDialogOpen(false);
                    const closed = returningAssignment;
                    setReturningAssignment(null);
                    if (closed) {
                        setReturnedForNote({
                            ...closed,
                            status: 'RETURNED',
                            returnedDate: new Date().toISOString(),
                            returnReason: returnForm.returnReason,
                            returnCondition: returnForm.returnCondition,
                            returnNotes: returnForm.notes,
                        });
                        setReturnNoteOpen(true);
                    }
                },
                onError: () => sileo.error({ title: 'Error', description: 'No se pudo registrar la devolución' }),
            }
        );
    };

    const handleSwap = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await swapEquipment({
                oldAssignmentId: swapForm.oldAssignmentId,
                newEquipmentId: swapForm.newEquipmentId,
                returnReason: swapForm.returnReason,
                returnCondition: swapForm.returnCondition,
                assignmentNotes: swapForm.assignmentNotes,
                deliveryReason: 'Cambio de equipo',
            });
            sileo.success({ title: 'Cambio de equipo registrado' });
            setSwapDialogOpen(false);
            setSwapForm({
                oldAssignmentId: '',
                newEquipmentId: '',
                returnReason: 'Cambio de equipo',
                returnCondition: 'BUENO',
                assignmentNotes: '',
            });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo realizar el cambio' });
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Asignaciones de Equipos" description="Entrega, devolución y trazabilidad de activos">
                    {canCreate && (
                        <div className="flex gap-2">
                        <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline"><ArrowLeftRight className="h-4 w-4 mr-2" /> Cambio de equipo</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Cambio de equipo</DialogTitle>
                                    <DialogDescription>Devuelve el equipo anterior y asigna uno nuevo al mismo empleado.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSwap} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Asignación activa (equipo anterior)</Label>
                                        <Select value={swapForm.oldAssignmentId} onValueChange={(v) => setSwapForm((f) => ({ ...f, oldAssignmentId: v }))}>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                            <SelectContent>
                                                {activeAssignments.map((a) => (
                                                    <SelectItem key={a.id} value={a.id}>
                                                        {a.equipment?.code} — {getAssigneeName(a)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Equipo nuevo</Label>
                                        <Select value={swapForm.newEquipmentId} onValueChange={(v) => setSwapForm((f) => ({ ...f, newEquipmentId: v }))}>
                                            <SelectTrigger><SelectValue placeholder="Equipo disponible" /></SelectTrigger>
                                            <SelectContent>
                                                {availableEquipment.map((eq) => (
                                                    <SelectItem key={eq.id} value={eq.id}>{eq.code} — {eq.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estado del equipo anterior</Label>
                                        <Select value={swapForm.returnCondition} onValueChange={(v) => setSwapForm((f) => ({ ...f, returnCondition: v }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {returnConditions.map((c) => (
                                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Observaciones</Label>
                                        <Input value={swapForm.assignmentNotes} onChange={(e) => setSwapForm((f) => ({ ...f, assignmentNotes: e.target.value }))} />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isSwapping || !swapForm.oldAssignmentId || !swapForm.newEquipmentId}>
                                            {isSwapping ? 'Procesando...' : 'Confirmar cambio'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="h-4 w-4 mr-2" /> Nueva Asignación</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Nueva Asignación</DialogTitle>
                                    <DialogDescription>
                                        Asigna un equipo disponible a un empleado. Se guardará snapshot de departamento y puesto.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Equipo</Label>
                                        <Select value={form.equipmentId} onValueChange={(v) => setForm((f) => ({ ...f, equipmentId: v }))}>
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
                                        <Label>Empleado</Label>
                                        <Select value={form.employeeId} onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona un empleado" /></SelectTrigger>
                                            <SelectContent>
                                                {employees.map((emp) => (
                                                    <SelectItem key={emp.id} value={emp.id}>
                                                        {emp.fullName} ({emp.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedEmployee && (
                                            <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                                                {selectedEmployee.department?.name || 'Sin departamento'} · {selectedEmployee.position?.name || 'Sin puesto'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Motivo de entrega</Label>
                                        <Select value={form.deliveryReason} onValueChange={(v) => setForm((f) => ({ ...f, deliveryReason: v }))}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona motivo" /></SelectTrigger>
                                            <SelectContent>
                                                {deliveryReasons.map((r) => (
                                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Condición del equipo</Label>
                                        <Input
                                            placeholder="Ej: Bueno, con cargador y mouse"
                                            value={form.condition}
                                            onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Accesorios entregados</Label>
                                        <Input
                                            placeholder="Cargador, mouse, funda..."
                                            value={form.accessories}
                                            onChange={(e) => setForm((f) => ({ ...f, accessories: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Observaciones</Label>
                                        <Input
                                            placeholder="Notas opcionales"
                                            value={form.notes}
                                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isCreating || !form.equipmentId || !form.employeeId}>
                                            {isCreating ? 'Asignando...' : 'Crear Asignación'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                        </div>
                    )}
                </PageHeader>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por empleado, equipo o código..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
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
                                        <TableHead>Empleado</TableHead>
                                        <TableHead className="hidden md:table-cell">Departamento</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="hidden md:table-cell">Fecha Asig.</TableHead>
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
                                                <p className="text-sm">{getAssigneeName(assignment)}</p>
                                                <p className="text-xs text-muted-foreground">{assignment.positionAtTime ?? ''}</p>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                                {assignment.departmentAtTime ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusColors[assignment.status]}>
                                                    {statusLabels[assignment.status] ?? assignment.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                                {formatDate(assignment.assignedDate)}
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

            <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Devolución</DialogTitle>
                        <DialogDescription>
                            Equipo: <strong>{returningAssignment?.equipment?.name ?? '—'}</strong>
                            <br />
                            Empleado: <strong>{returningAssignment ? getAssigneeName(returningAssignment) : '—'}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConfirmReturn} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Motivo de devolución</Label>
                            <Select
                                value={returnForm.returnReason}
                                onValueChange={(v) => setReturnForm((f) => ({ ...f, returnReason: v }))}
                            >
                                <SelectTrigger><SelectValue placeholder="Selecciona motivo" /></SelectTrigger>
                                <SelectContent>
                                    {returnReasons.map((r) => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Estado físico del equipo</Label>
                            <Select
                                value={returnForm.returnCondition}
                                onValueChange={(v) => setReturnForm((f) => ({ ...f, returnCondition: v }))}
                            >
                                <SelectTrigger><SelectValue placeholder="Selecciona condición" /></SelectTrigger>
                                <SelectContent>
                                    {returnConditions.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Accesorios devueltos</Label>
                            <Input
                                placeholder="Cargador, mouse..."
                                value={returnForm.accessoriesReturned}
                                onChange={(e) => setReturnForm((f) => ({ ...f, accessoriesReturned: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Observaciones</Label>
                            <Input
                                placeholder="Detalles adicionales..."
                                value={returnForm.notes}
                                onChange={(e) => setReturnForm((f) => ({ ...f, notes: e.target.value }))}
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

            <Dialog open={returnNoteOpen} onOpenChange={setReturnNoteOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Acta de devolución</DialogTitle>
                        <DialogDescription>Imprime o guarda como PDF. Luego puedes subir el formato firmado.</DialogDescription>
                    </DialogHeader>
                    {returnedForNote?.equipment && (
                        <div className="border rounded-xl p-4 bg-muted/20">
                            <ReturnNoteContent equipment={returnedForNote.equipment} assignment={returnedForNote} />
                        </div>
                    )}
                    {returnedForNote && (
                        <EquipmentFileUpload
                            tipoDocumento="ACTA_DEVOLUCION"
                            label="Subir formato firmado"
                            onUploaded={async (url) => {
                                await attachDocument({ id: returnedForNote.id, documentType: 'return', documentUrl: url });
                            }}
                        />
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReturnNoteOpen(false)}>Cerrar</Button>
                        <Button onClick={() => setTimeout(() => window.print(), 100)}>
                            <Printer className="h-4 w-4 mr-2" /> Imprimir / PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
