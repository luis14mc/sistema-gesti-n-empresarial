'use client';

// ============================================
// OFICIOS PAGE — Gestión completa de oficios
// ============================================
// CRUD: crear, ver detalle, editar, eliminar, cambiar estado,
// filtrar por tipo y estado, asignar destinatario

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
    Plus, Search, Filter, Edit3, Trash2, ArrowRight,
    Send, FileCheck, Archive, RotateCcw,
    FileText as FileIcon, Eye, ExternalLink, History
} from 'lucide-react';
import Link from 'next/link';
import { useOficios, useOficioDetail } from '@/hooks/useOficios';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/shared/Pagination';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { formatRelativeDate } from '@/utils/helpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Role, OficioType, OficioStatus } from '@/types';

// ============================================
// CONSTANTS
// ============================================

const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    SENT: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    RECEIVED: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900',
    IN_PROCESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    COMPLETED: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
    ARCHIVED: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
    DRAFT: 'Borrador', SENT: 'Enviado', RECEIVED: 'Recibido',
    IN_PROCESS: 'En Proceso', COMPLETED: 'Completado', ARCHIVED: 'Archivado',
};

const typeLabels: Record<string, string> = {
    INCOMING: 'Entrante', OUTGOING: 'Saliente', INTERNAL: 'Interno',
};

const statusTransitions: Record<string, { next: OficioStatus; label: string; icon: typeof ArrowRight }[]> = {
    DRAFT: [{ next: 'SENT', label: 'Enviar', icon: Send }],
    SENT: [{ next: 'RECEIVED', label: 'Marcar recibido', icon: FileCheck }],
    RECEIVED: [{ next: 'IN_PROCESS', label: 'En proceso', icon: ArrowRight }],
    IN_PROCESS: [{ next: 'COMPLETED', label: 'Completar', icon: FileCheck }],
    COMPLETED: [{ next: 'ARCHIVED', label: 'Archivar', icon: Archive }],
    ARCHIVED: [],
};

// ============================================
// PAGE
// ============================================

export default function OficiosPage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);

    const {
        oficios,
        total,
        totalPages,
        isLoading,
        createOficio,
        isCreating,
        deleteOficio
    } = useOficios({
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? undefined : statusFilter as any,
        type: typeFilter === 'ALL' ? undefined : typeFilter as any,
        page,
        pageSize: 10
    });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedOficioId, setSelectedOficioId] = useState<string | null>(null);
    const sheetOpen = selectedOficioId !== null;

    const role = (user?.role ?? 'USER') as Role;
    const canCreate = canAccess(role, 'oficios', 'create');
    const canDelete = canAccess(role, 'oficios', 'delete');
    const canAudit = role === 'ADMIN' || role === 'IT';

    const [form, setForm] = useState({ subject: '', type: 'OUTGOING', oficioDate: '', origin: 'CNI', attachmentUrl: '', comments: '' });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.attachmentUrl) {
            sileo.error({ title: 'Adjunto Requerido', description: 'Debes adjuntar el documento escaneado (PDF/Imagen).' });
            return;
        }
        try {
            await createOficio({
                subject: form.subject,
                type: form.type as OficioType,
                oficioDate: form.oficioDate,
                origin: form.origin,
                attachments: [form.attachmentUrl],
                comments: form.comments || undefined,
            } as any);
            sileo.success({ title: 'Oficio creado', description: 'Se registró correctamente' });
            setDialogOpen(false);
            setForm({ subject: '', type: 'OUTGOING', oficioDate: '', origin: 'CNI', attachmentUrl: '', comments: '' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo crear el oficio' });
        }
    };

    const handleDeleteFromTable = async (id: string, subject: string) => {
        const result = await swalConfirm('¿Eliminar oficio?', `Se eliminará "${subject}" permanentemente.`, 'Sí, eliminar');
        if (!result.isConfirmed) return;
        try {
            await deleteOficio(id);
            sileo.success({ title: 'Oficio eliminado' });
            if (selectedOficioId === id) setSelectedOficioId(null);
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Oficios" description="Registro y seguimiento de oficios institucionales">
                    {canCreate && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Oficio</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Nuevo Oficio</DialogTitle>
                                    <DialogDescription>Registra un nuevo oficio en el sistema.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Asunto *</Label>
                                        <Input placeholder="Asunto del oficio" value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>Tipo *</Label>
                                            <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="INCOMING">Entrante</SelectItem>
                                                    <SelectItem value="OUTGOING">Saliente</SelectItem>
                                                    <SelectItem value="INTERNAL_MEMO">Memo Interno</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Origen *</Label>
                                            <Select value={form.origin} onValueChange={(v) => setForm(f => ({ ...f, origin: v }))}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CNI">CNI</SelectItem>
                                                    <SelectItem value="DPICP">DPICP</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha del Oficio *</Label>
                                        <Input type="date" value={form.oficioDate} onChange={(e) => setForm(f => ({ ...f, oficioDate: e.target.value }))} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Documento Adjunto (URL) *</Label>
                                        <Input
                                            placeholder="URL del documento escaneado (PDF/Imagen)"
                                            value={form.attachmentUrl}
                                            onChange={(e) => setForm(f => ({ ...f, attachmentUrl: e.target.value }))}
                                            required
                                        />
                                        <p className="text-[10px] text-muted-foreground">Obligatorio. URL del PDF o imagen del documento oficial.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Comentarios</Label>
                                        <textarea
                                            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 resize-none"
                                            placeholder="Notas u observaciones (opcional)"
                                            value={form.comments}
                                            onChange={(e) => setForm(f => ({ ...f, comments: e.target.value }))}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isCreating}>
                                            {isCreating ? 'Creando...' : 'Crear Oficio'}
                                        </Button>
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
                        <Input placeholder="Buscar por asunto o número..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            <SelectItem value="INCOMING">Entrante</SelectItem>
                            <SelectItem value="OUTGOING">Saliente</SelectItem>
                            <SelectItem value="INTERNAL">Interno</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-40">
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
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Asunto</TableHead>
                                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="hidden lg:table-cell">Registrado</TableHead>
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
                                ) : oficios.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            No se encontraron oficios
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    oficios.map((oficio) => (
                                        <TableRow
                                            key={oficio.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => setSelectedOficioId(oficio.id)}
                                        >
                                            <TableCell className="font-mono text-xs font-semibold">
                                                {oficio.number}
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-sm font-medium line-clamp-1">{oficio.subject}</p>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <span className="text-xs uppercase font-medium">{typeLabels[oficio.type]}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={statusColors[oficio.status]}>
                                                    {statusLabels[oficio.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                                {formatRelativeDate(oficio.createdAt)}
                                            </TableCell>
                                            {canDelete && (
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteFromTable(oficio.id, oficio.subject)}
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
            <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) setSelectedOficioId(null); }}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                    {selectedOficioId && (
                        <OficioDetailPanel
                            oficioId={selectedOficioId}
                            role={role}
                            onClose={() => setSelectedOficioId(null)}
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

function OficioDetailPanel({ oficioId, role, onClose }: { oficioId: string; role: Role; onClose: () => void }) {
    const { oficio, isLoading, updateOficio, isUpdating, deleteOficio } = useOficioDetail(oficioId);
    const canUpdate = canAccess(role, 'oficios', 'update');
    const canDelete = canAccess(role, 'oficios', 'delete');
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ subject: '', comments: '' });

    if (isLoading || !oficio) {
        return (
            <div className="space-y-4 pt-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    const transitions = statusTransitions[oficio.status] ?? [];

    const handleStatusChange = async (newStatus: OficioStatus) => {
        try {
            await updateOficio({ status: newStatus });
            sileo.success({ title: `Estado: ${statusLabels[newStatus]}` });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar el estado' });
        }
    };

    const handleDelete = async () => {
        const result = await swalConfirm('¿Eliminar oficio?', `Se eliminará "${oficio.subject}" permanentemente.`, 'Sí, eliminar');
        if (!result.isConfirmed) return;
        try {
            await deleteOficio();
            sileo.success({ title: 'Oficio eliminado' });
            onClose();
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
        }
    };

    const startEditing = () => {
        setEditForm({ subject: oficio.subject, comments: oficio.comments || '' });
        setEditing(true);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateOficio({
                subject: editForm.subject,
                comments: editForm.comments || undefined,
            } as any);
            setEditing(false);
            sileo.success({ title: 'Oficio actualizado' });
        } catch {
            sileo.error({ title: 'Error', description: 'No se pudo actualizar' });
        }
    };

    return (
        <div className="space-y-6 pt-2">
            <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs text-muted-foreground font-mono mb-1">{oficio.number}</p>
                        <SheetTitle className="text-lg font-heading leading-snug">{oficio.subject}</SheetTitle>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            asChild
                        >
                            <Link href={`/admin/audit-logs?entityId=${oficioId}`}>
                                <History className="h-4 w-4" />
                            </Link>
                        </Button>
                        {canUpdate && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditing}>
                                <Edit3 className="h-4 w-4" />
                            </Button>
                        )}
                        {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </SheetHeader>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={statusColors[oficio.status]}>{statusLabels[oficio.status]}</Badge>
                <Badge variant="outline">{typeLabels[oficio.type]}</Badge>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-xs text-muted-foreground">Creado por</p>
                    <p className="font-medium">{oficio.createdBy?.firstName} {oficio.createdBy?.lastName}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Fecha del Oficio</p>
                    <p className="font-medium">{oficio.oficioDate ? format(new Date(oficio.oficioDate), "dd/MM/yyyy", { locale: es }) : '—'}</p>
                </div>
                {oficio.receivedDate && (
                    <div>
                        <p className="text-xs text-muted-foreground">Fecha de recepción</p>
                        <p className="font-medium">{format(new Date(oficio.receivedDate), "dd/MM/yyyy", { locale: es })}</p>
                    </div>
                )}
                {oficio.sentDate && (
                    <div>
                        <p className="text-xs text-muted-foreground">Fecha de envío</p>
                        <p className="font-medium">{format(new Date(oficio.sentDate), "dd/MM/yyyy", { locale: es })}</p>
                    </div>
                )}
            </div>

            {/* Documento y Comentarios */}
            <div>
                <p className="text-xs text-muted-foreground mb-1">Documento / Adjuntos</p>
                <div className="bg-muted/30 rounded-lg p-3 space-y-4">
                    {oficio.comments && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{oficio.comments}</p>
                    )}

                    {oficio.attachments && Array.isArray(oficio.attachments) && (oficio.attachments as string[]).length > 0 ? (
                        <div className="pt-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                                <FileIcon className="h-3 w-3" /> Documentos Adjuntos
                            </p>
                            {(oficio.attachments as string[]).map((url: string, idx: number) => (
                                <Button key={idx} variant="outline" className="w-full justify-start h-auto py-3 gap-3 mb-2" asChild>
                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                            <FileIcon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="text-left min-w-0">
                                            <p className="text-xs font-semibold truncate">Documento {idx + 1}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">Se abrirá en una nueva pestaña</p>
                                        </div>
                                        <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                                    </a>
                                </Button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            <Separator />

            {/* Status transitions */}
            {canUpdate && transitions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Cambiar estado</p>
                    <div className="flex flex-wrap gap-2">
                        {transitions.map(t => {
                            const Icon = t.icon;
                            return (
                                <Button key={t.next} variant="outline" size="sm" disabled={isUpdating} onClick={() => handleStatusChange(t.next)}>
                                    <Icon className="h-3.5 w-3.5 mr-1.5" /> {t.label}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar Oficio</DialogTitle>
                        <DialogDescription>Modifica la información del oficio.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Asunto</Label>
                            <Input value={editForm.subject} onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Comentarios</Label>
                            <textarea
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 resize-none"
                                value={editForm.comments}
                                onChange={(e) => setEditForm(f => ({ ...f, comments: e.target.value }))}
                                placeholder="Notas u observaciones"
                            />
                        </div>
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
