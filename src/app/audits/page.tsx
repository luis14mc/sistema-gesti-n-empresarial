'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Filter, Calendar, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAudits } from '@/hooks/useAudits';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/shared/Pagination';
import { useUsers } from '@/hooks/useUsers';
import { canAccess } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import { sileo } from 'sileo';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

const statusColors: Record<string, string> = {
    PLANNED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const statusLabels: Record<string, string> = {
    PLANNED: 'Planeada',
    IN_PROGRESS: 'En Progreso',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
};

export default function AuditsPage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);

    const {
        audits,
        total,
        totalPages,
        isLoading,
        createAudit,
        isCreating
    } = useAudits({
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        pageSize: 10
    });

    const { users } = useUsers();
    const [dialogOpen, setDialogOpen] = useState(false);

    const canCreate = canAccess(user?.role as any, 'audit-records' as any, 'create');

    const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        try {
            await createAudit({
                title: formData.get('title') as string,
                type: formData.get('type') as any,
                standard: formData.get('standard') as string,
                scope: formData.get('scope') as string,
                criteria: formData.get('criteria') as string,
                objectives: formData.get('objectives') as string,
                leadAuditorId: formData.get('leadAuditorId') as string,
                plannedDate: formData.get('plannedDate') as string,
                department: formData.get('department') as string,
            });

            setDialogOpen(false);
            sileo.success({ title: 'Auditoría creada', description: 'La auditoría ha sido programada exitosamente.' });
        } catch (error) {
            sileo.error({ title: 'Error', description: 'No se pudo crear la auditoría.' });
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Auditorías ISO 19011"
                    description="Gestión de programas y ejecución de auditorías de calidad."
                >
                    {canCreate && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" /> Programar Auditoría
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Programar Nueva Auditoría</DialogTitle>
                                    <DialogDescription>
                                        Complete los detalles para programar una nueva auditoría en el sistema.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreate} className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="title">Título de la Auditoría</Label>
                                            <Input id="title" name="title" placeholder="Ej: Auditoría Interna de Calidad 2024" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="type">Tipo</Label>
                                            <Select name="type" defaultValue="INTERNAL">
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione tipo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="INTERNAL">Interna</SelectItem>
                                                    <SelectItem value="EXTERNAL">Externa</SelectItem>
                                                    <SelectItem value="COMBINED">Combinada</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="standard">Norma/Estándar</Label>
                                            <Input id="standard" name="standard" placeholder="Ej: ISO 9001:2015" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="plannedDate">Fecha Planificada</Label>
                                            <Input id="plannedDate" name="plannedDate" type="date" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="department">Departamento/Área</Label>
                                            <Input id="department" name="department" placeholder="Ej: Operaciones" />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="leadAuditorId">Auditor Líder</Label>
                                            <Select name="leadAuditorId" required>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione auditor" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {users.map(u => (
                                                        <SelectItem key={u.id} value={u.id}>
                                                            {u.firstName} {u.lastName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="scope">Alcance</Label>
                                            <Textarea id="scope" name="scope" placeholder="Define los límites de la auditoría..." />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="objectives">Objetivos</Label>
                                            <Textarea id="objectives" name="objectives" placeholder="¿Qué se busca lograr?" />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="criteria">Criterios</Label>
                                            <Textarea id="criteria" name="criteria" placeholder="Documentos de referencia, políticas..." />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={isCreating}>
                                            {isCreating ? 'Guardando...' : 'Crear Auditoría'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </PageHeader>

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por título o código..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos los estados</SelectItem>
                                <SelectItem value="PLANNED">Planeadas</SelectItem>
                                <SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
                                <SelectItem value="COMPLETED">Completadas</SelectItem>
                                <SelectItem value="CANCELLED">Canceladas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        {isLoading && page === 1 ? (
                            <div className="p-8 space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : audits.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No se encontraron auditorías que coincidan con los filtros.</p>
                            </div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-24">Código</TableHead>
                                            <TableHead>Auditoría</TableHead>
                                            <TableHead>Auditor Líder</TableHead>
                                            <TableHead>Fecha Planificada</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {audits.map((audit) => (
                                            <TableRow key={audit.id}>
                                                <TableCell className="font-mono font-medium text-xs">
                                                    {audit.code}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{audit.title}</span>
                                                        <span className="text-xs text-muted-foreground">{audit.standard}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                        {audit.leadAuditor?.firstName} {audit.leadAuditor?.lastName}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Calendar className="h-3 w-3" />
                                                        {audit.plannedDate ? format(new Date(audit.plannedDate), 'dd MMM yyyy', { locale: es }) : '—'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={statusColors[audit.status]}>
                                                        {statusLabels[audit.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/audits/${audit.id}`}>
                                                            Gestionar <ArrowRight className="ml-2 h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                <Pagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={setPage}
                                    isLoading={isLoading}
                                />
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
