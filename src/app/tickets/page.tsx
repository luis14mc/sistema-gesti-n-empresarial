'use client';

// ============================================
// TICKETS PAGE — Gestión completa de tickets
// ============================================
// CRUD completo: crear, ver detalle, editar, eliminar,
// cambiar estado, asignar técnico, comentarios

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
    Plus, Search, Filter, MessageSquare, User as UserIcon, Clock,
    Trash2, Edit3, ArrowRight, Send, AlertCircle, CheckCircle2,
    Eye, ExternalLink, History
} from 'lucide-react';
import Link from 'next/link';
import { useTickets, useTicketDetail } from '@/hooks/useTickets';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/shared/Pagination';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { formatRelativeDate } from '@/utils/helpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Role, TicketPriority, TicketStatus, Ticket } from '@/types';

// ============================================
// STATUS / PRIORITY BADGES
// ============================================

const statusColors: Record<string, string> = {
    OPEN: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    IN_PROGRESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    RESOLVED: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
    CLOSED: 'bg-muted text-muted-foreground border-border',
    CANCELLED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
};

const statusLabels: Record<string, string> = {
    OPEN: 'Abierto', IN_PROGRESS: 'En Progreso', RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado', CANCELLED: 'Cancelado',
};

const priorityColors: Record<string, string> = {
    LOW: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    MEDIUM: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    HIGH: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    URGENT: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const priorityLabels: Record<string, string> = {
    LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente',
};

const typeLabelsTicket: Record<string, string> = {
    HARDWARE: 'Hardware', SOFTWARE: 'Software', NETWORK: 'Red',
    ACCESS: 'Acceso', OTHER: 'Otro',
};

// Status workflow (next valid transitions)
const statusTransitions: Record<string, { next: TicketStatus; label: string; icon: typeof ArrowRight }[]> = {
    OPEN: [
        { next: 'IN_PROGRESS', label: 'Iniciar', icon: ArrowRight },
        { next: 'CANCELLED', label: 'Cancelar', icon: AlertCircle },
    ],
    IN_PROGRESS: [
        { next: 'RESOLVED', label: 'Resolver', icon: CheckCircle2 },
        { next: 'CANCELLED', label: 'Cancelar', icon: AlertCircle },
    ],
    RESOLVED: [
        { next: 'CLOSED', label: 'Cerrar', icon: CheckCircle2 },
        { next: 'OPEN', label: 'Reabrir', icon: ArrowRight },
    ],
    CLOSED: [],
    CANCELLED: [
        { next: 'OPEN', label: 'Reabrir', icon: ArrowRight },
    ],
};

// ============================================
// PAGE
// ============================================

export default function TicketsPage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const {
        tickets,
        total,
        totalPages,
        isLoading,
        createTicket,
        isCreating,
        deleteTicket,
        isDeleting
    } = useTickets({
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? undefined : statusFilter as any,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter as any,
        page,
        pageSize: 10
    });

    // Detail sheet state
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const sheetOpen = selectedTicketId !== null;

    const role = (user?.role ?? 'USER') as Role;
    const canCreate = canAccess(role, 'tickets', 'create');
    const canDelete = canAccess(role, 'tickets', 'delete');

    // Form state
    const [newTicket, setNewTicket] = useState({
        title: '', description: '', priority: 'MEDIUM', type: 'OTHER', attachmentUrl: ''
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTicket.attachmentUrl) {
            sileo.error({ title: 'Adjunto Requerido', description: 'Por favor, incluye una captura o imagen del error.' });
            return;
        }
        try {
            await createTicket({
                title: newTicket.title,
                description: newTicket.description,
                priority: newTicket.priority as TicketPriority,
                type: newTicket.type,
                attachments: [newTicket.attachmentUrl],
            } as any);
            setCreateDialogOpen(false);
            setNewTicket({ title: '', description: '', priority: 'MEDIUM', type: 'OTHER', attachmentUrl: '' });
            sileo.success({ title: 'Ticket creado exitosamente' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo crear el ticket' });
        }
    };

    const handleDelete = async (ticket: Ticket) => {
        const result = await swalConfirm(
            '¿Eliminar ticket?',
            `Se eliminará "${ticket.title}" permanentemente.`,
            'Sí, eliminar',
        );
        if (!result.isConfirmed) return;
        try {
            await deleteTicket(ticket.id);
            sileo.success({ title: 'Ticket eliminado' });
            if (selectedTicketId === ticket.id) setSelectedTicketId(null);
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Tickets de Soporte" description="Gestión de solicitudes y seguimiento">
                    {canCreate && (
                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Ticket</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Nuevo Ticket</DialogTitle>
                                    <DialogDescription>Completa la información para crear un nuevo ticket de soporte.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Título</Label>
                                        <Input placeholder="Describe el problema brevemente" value={newTicket.title} onChange={(e) => setNewTicket(f => ({ ...f, title: e.target.value }))} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Descripción</Label>
                                        <textarea
                                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 resize-none"
                                            placeholder="Detalla el problema..."
                                            value={newTicket.description}
                                            onChange={(e) => setNewTicket(f => ({ ...f, description: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Prioridad</Label>
                                            <Select value={newTicket.priority} onValueChange={(v) => setNewTicket(f => ({ ...f, priority: v }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LOW">Baja</SelectItem>
                                                    <SelectItem value="MEDIUM">Media</SelectItem>
                                                    <SelectItem value="HIGH">Alta</SelectItem>
                                                    <SelectItem value="URGENT">Urgente</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tipo</Label>
                                            <Select value={newTicket.type} onValueChange={(v) => setNewTicket(f => ({ ...f, type: v }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(typeLabelsTicket).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Adjunto (URL de imagen)</Label>
                                        <Input
                                            placeholder="URL de una captura o imagen del problema"
                                            value={newTicket.attachmentUrl}
                                            onChange={(e) => setNewTicket(f => ({ ...f, attachmentUrl: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isCreating}>
                                            {isCreating ? 'Creando...' : 'Crear Ticket'}
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
                        <Input placeholder="Buscar tickets..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-44">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            <SelectItem value="OPEN">Abierto</SelectItem>
                            <SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
                            <SelectItem value="RESOLVED">Resuelto</SelectItem>
                            <SelectItem value="CLOSED">Cerrado</SelectItem>
                            <SelectItem value="CANCELLED">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                            <SelectValue placeholder="Prioridad" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas</SelectItem>
                            <SelectItem value="LOW">Baja</SelectItem>
                            <SelectItem value="MEDIUM">Media</SelectItem>
                            <SelectItem value="HIGH">Alta</SelectItem>
                            <SelectItem value="URGENT">Urgente</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Título</TableHead>
                                    <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="hidden md:table-cell">Prioridad</TableHead>
                                    <TableHead className="hidden lg:table-cell">Creado</TableHead>
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
                                ) : tickets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            No se encontraron tickets
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tickets.map((tk) => (
                                        <TableRow
                                            key={tk.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => setSelectedTicketId(tk.id)}
                                        >
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{tk.title}</p>
                                                    <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                                                        {typeLabelsTicket[tk.type]}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <span className="text-sm">{typeLabelsTicket[tk.type]}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusColors[tk.status]}>
                                                    {statusLabels[tk.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <Badge variant="outline" className={priorityColors[tk.priority]}>
                                                    {priorityLabels[tk.priority]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                                {formatRelativeDate(tk.createdAt)}
                                            </TableCell>
                                            {canDelete && (
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(tk); }}
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
            <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) setSelectedTicketId(null); }}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                    {selectedTicketId && (
                        <TicketDetailPanel
                            ticketId={selectedTicketId}
                            role={role}
                            currentUserId={user?.id ?? ''}
                            onClose={() => setSelectedTicketId(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </MainLayout>
    );
}

// ============================================
// DETAIL PANEL (renders inside Sheet)
// ============================================

function TicketDetailPanel({
    ticketId,
    role,
    currentUserId,
    onClose,
}: {
    ticketId: string;
    role: Role;
    currentUserId: string;
    onClose: () => void;
}) {
    const {
        ticket: tk, isLoading, updateTicket, isUpdating,
        deleteTicket, isDeleting, addComment, isAddingComment,
    } = useTicketDetail(ticketId);

    const { users } = useUsers({ role: 'IT' });
    const allUsers = useUsers();

    const canUpdate = canAccess(role, 'tickets', 'update');
    const canDelete = canAccess(role, 'tickets', 'delete');

    const [commentText, setCommentText] = useState('');
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', description: '', priority: '', type: '' });

    const technicians = [...users, ...allUsers.users.filter(u => u.role === 'ADMIN')]
        .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);

    if (isLoading || !tk) {
        return (
            <div className="space-y-4 pt-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

    const transitions = statusTransitions[tk.status] ?? [];

    const handleStatusChange = async (newStatus: TicketStatus) => {
        try {
            await updateTicket({ status: newStatus });
            sileo.success({ title: `Estado: ${statusLabels[newStatus]}` });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar el estado' });
        }
    };

    const handleAssign = async (userId: string) => {
        try {
            await updateTicket({ assignedToId: userId || undefined });
            sileo.success({ title: 'Técnico asignado' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo asignar' });
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        try {
            await addComment({ content: commentText.trim() });
            setCommentText('');
            sileo.success({ title: 'Comentario agregado' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo agregar comentario' });
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateTicket({
                title: editForm.title,
                description: editForm.description,
                priority: editForm.priority as TicketPriority,
                type: editForm.type,
            } as any);
            setEditing(false);
            sileo.success({ title: 'Ticket actualizado' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar' });
        }
    };

    const handleDeleteTicket = async () => {
        const result = await swalConfirm(
            '¿Eliminar ticket?',
            `Se eliminará "${tk.title}" permanentemente.`,
            'Sí, eliminar',
        );
        if (!result.isConfirmed) return;
        try {
            await deleteTicket();
            sileo.success({ title: 'Ticket eliminado' });
            onClose();
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    const startEditing = () => {
        setEditForm({
            title: tk.title,
            description: tk.description,
            priority: tk.priority,
            type: tk.type,
        });
        setEditing(true);
    };

    return (
        <div className="space-y-6 pt-2">
            {/* Header */}
            <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                    <SheetTitle className="text-lg font-heading leading-snug pr-2">{tk.title}</SheetTitle>
                    <div className="flex gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            asChild
                        >
                            <Link href={`/admin/audit-logs?entityId=${ticketId}`}>
                                <History className="h-4 w-4" />
                            </Link>
                        </Button>
                        {canUpdate && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditing}>
                                <Edit3 className="h-4 w-4" />
                            </Button>
                        )}
                        {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDeleteTicket} disabled={isDeleting}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </SheetHeader>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={statusColors[tk.status]}>{statusLabels[tk.status]}</Badge>
                <Badge variant="outline" className={priorityColors[tk.priority]}>{priorityLabels[tk.priority]}</Badge>
                <Badge variant="outline">{typeLabelsTicket[tk.type] || tk.type}</Badge>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-xs text-muted-foreground">Creado por</p>
                    <p className="font-medium">{tk.createdBy?.firstName} {tk.createdBy?.lastName}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium">{format(new Date(tk.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                </div>
                {tk.assignedTo && (
                    <div>
                        <p className="text-xs text-muted-foreground">Asignado a</p>
                        <p className="font-medium">{tk.assignedTo.firstName} {tk.assignedTo.lastName}</p>
                    </div>
                )}
                {tk.resolvedAt && (
                    <div>
                        <p className="text-xs text-muted-foreground">Resuelto</p>
                        <p className="font-medium">{format(new Date(tk.resolvedAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                    </div>
                )}
            </div>

            {/* Description */}
            <div>
                <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{tk.description}</p>

                    {tk.attachments && Array.isArray(tk.attachments) && (tk.attachments as string[]).length > 0 && (
                        <div className="pt-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                                <Eye className="h-3 w-3" /> Evidencia adjunta
                            </p>
                            {(tk.attachments as string[]).map((url: string, idx: number) => (
                                <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block relative aspect-video w-full overflow-hidden rounded-md border border-border group mb-2"
                                >
                                    <img
                                        src={url}
                                        alt={`Evidencia ${idx + 1}`}
                                        className="object-cover w-full h-full transition-transform group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ExternalLink className="h-6 w-6 text-white" />
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Separator />

            {/* Assign technician */}
            {canUpdate && (
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <UserIcon className="h-3.5 w-3.5" /> Asignar técnico
                    </Label>
                    <Select
                        value={tk.assignedToId ?? 'NONE'}
                        onValueChange={(v) => handleAssign(v === 'NONE' ? '' : v)}
                    >
                        <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NONE">Sin asignar</SelectItem>
                            {technicians.map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                    {u.firstName} {u.lastName} ({u.role})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Workflow status change */}
            <div className="space-y-4">
                {tk.status === 'RESOLVED' && tk.createdById === currentUserId && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold">¿Se resolvió tu problema?</p>
                                <p className="text-xs text-muted-foreground">Confirma que la solución es satisfactoria para cerrar definitivamente el ticket.</p>
                            </div>
                        </div>
                        <Button
                            className="w-full"
                            onClick={() => handleStatusChange('CLOSED')}
                            disabled={isUpdating}
                        >
                            Confirmar Solución y Cerrar
                        </Button>
                    </div>
                )}

                {canUpdate && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Cambiar estado (Administrador/Técnico)</Label>
                        <Select
                            value={tk.status}
                            onValueChange={(v) => handleStatusChange(v as TicketStatus)}
                            disabled={isUpdating}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(statusLabels).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <Separator />

            {/* Comments */}
            <div className="space-y-4 pt-4">
                <p className="text-sm font-semibold">Comentarios ({tk.comments?.length || 0})</p>
                <div className="space-y-4">
                    {tk.comments?.map((c: any) => (
                        <div key={c.id} className="flex gap-3">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium">{c.user?.firstName} {c.user?.lastName}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatRelativeDate(c.createdAt)}</p>
                                </div>
                                <p className="text-sm bg-muted/30 rounded-lg p-2 leading-relaxed">
                                    {c.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add comment */}
                <form onSubmit={handleComment} className="flex gap-2 pt-2">
                    <Input
                        placeholder="Escribe un comentario..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        disabled={isAddingComment}
                    />
                    <Button type="submit" size="icon" disabled={isAddingComment || !commentText.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>

            {/* Edit Dialog */}
            <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar Ticket</DialogTitle>
                        <DialogDescription>Modifica la información del ticket.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Título</Label>
                            <Input value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción</Label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 resize-none"
                                value={editForm.description}
                                onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Prioridad</Label>
                                <Select value={editForm.priority} onValueChange={(v) => setEditForm(f => ({ ...f, priority: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">Baja</SelectItem>
                                        <SelectItem value="MEDIUM">Media</SelectItem>
                                        <SelectItem value="HIGH">Alta</SelectItem>
                                        <SelectItem value="URGENT">Urgente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={editForm.type} onValueChange={(v) => setEditForm(f => ({ ...f, type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(typeLabelsTicket).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

