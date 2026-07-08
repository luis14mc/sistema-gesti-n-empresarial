'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/shared/Pagination';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, History, Shield, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const moduleLabels: Record<string, string> = {
    users: 'Usuarios',
    tickets: 'Tickets',
    oficios: 'Oficios',
    equipment: 'Equipos',
    inventory: 'Inventario',
    purchases: 'Compras',
    audits: 'Auditoría',
    attendance: 'Asistencia',
    settings: 'Ajustes',
};

const actionColors: Record<string, string> = {
    CREATE: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
    UPDATE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    DELETE: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900',
    LOGIN: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900',
    LOGOUT: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-900',
    CHECK_IN: 'bg-green-500/10 text-green-600',
    CHECK_OUT: 'bg-red-500/10 text-red-600',
};

export default function AuditLogsPage() {
    const [page, setPage] = useState(1);
    const [moduleFilter, setModuleFilter] = useState<string>('ALL');
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [selectedLog, setSelectedLog] = useState<any>(null);

    const { logs, total, totalPages, isLoading } = useAuditLogs({
        page,
        pageSize: 15,
        module: moduleFilter === 'ALL' ? undefined : moduleFilter,
        action: actionFilter === 'ALL' ? undefined : actionFilter,
    });

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Historial de Auditoría"
                    description="Monitoreo centralizado de todas las acciones del sistema"
                />

                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={moduleFilter} onValueChange={setModuleFilter}>
                        <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Módulo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos los módulos</SelectItem>
                            {Object.entries(moduleLabels).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Acción" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas las acciones</SelectItem>
                            <SelectItem value="CREATE">Creación</SelectItem>
                            <SelectItem value="UPDATE">Actualización</SelectItem>
                            <SelectItem value="DELETE">Eliminación</SelectItem>
                            <SelectItem value="LOGIN">Inicio Sesión</SelectItem>
                            <SelectItem value="CHECK_IN">Entrada Asistencia</SelectItem>
                            <SelectItem value="CHECK_OUT">Salida Asistencia</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Tabla */}
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha y Hora</TableHead>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Módulo</TableHead>
                                    <TableHead>Acción</TableHead>
                                    <TableHead className="hidden md:table-cell">ID Entidad</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            No se encontraron registros de auditoría
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                                            <TableCell className="text-sm">
                                                {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">
                                                {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistema'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-normal capitalize">
                                                    {moduleLabels[log.module] || log.module}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={actionColors[log.category] || ''}>
                                                    {log.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                                {log.entityId || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </TableCell>
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

            {/* Detail Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Detalle de Auditoría
                        </DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Fecha completo</p>
                                    <p className="text-sm font-medium">{format(new Date(selectedLog.createdAt), "EEEE, d 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es })}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">IP / Navegador</p>
                                    <p className="text-xs truncate">{selectedLog.ipAddress || 'Origen interno'} • {selectedLog.userAgent || 'Desconocido'}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-muted/30 rounded-lg space-y-2 border border-border">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payload / Detalles Técnicos</p>
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                                    {JSON.stringify(selectedLog.details, null, 2)}
                                </pre>
                            </div>

                            {selectedLog.details?.coords && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
                                        <Shield className="h-4 w-4" />
                                        <p className="text-xs font-semibold uppercase">Información de Ubicación</p>
                                    </div>
                                    <p className="text-sm font-medium">Lat: {selectedLog.details.coords.latitude} • Lng: {selectedLog.details.coords.longitude}</p>
                                    <Button variant="link" size="sm" className="px-0 h-auto text-blue-600" onClick={() => window.open(`https://www.google.com/maps?q=${selectedLog.details.coords.latitude},${selectedLog.details.coords.longitude}`, '_blank')}>
                                        Ver en Google Maps
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
