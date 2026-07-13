'use client';

// ============================================
// /audit/logs — Vista unificada de auditoría
// Sprint 2: reemplaza /audit-records y /admin/audit-logs
// Reúne listado + filtros + dialog de detalle en una sola página
// ============================================

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, History, Info, Search, Shield } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/shared/Pagination';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useDebounce } from '@/hooks/useDebounce';

interface AuditLogUser {
  firstName: string;
  lastName: string;
}

interface AuditLogDetails {
  previousData?: unknown;
  newData?: unknown;
  coords?: { latitude: number; longitude: number };
}

interface AuditLogEntry {
  id: string;
  createdAt: string;
  title: string;
  description?: string;
  module: string;
  category: string;
  ipAddress?: string;
  userAgent?: string;
  user?: AuditLogUser;
  entityId?: string;
  details?: AuditLogDetails;
}

const MODULE_LABELS: Record<string, string> = {
  TICKETS: 'Tickets',
  OFICIOS: 'Oficios',
  EQUIPMENT: 'Equipos',
  INVENTORY: 'Inventario',
  PURCHASES: 'Compras',
  USERS: 'Usuarios',
  AUTH: 'Autenticación',
  AUDITORIA: 'Auditoría ISO',
  MANUAL: 'Manual',
};

const CATEGORY_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  STATUS_CHANGE: 'Cambio de estado',
};

const CATEGORY_COLORS: Record<string, string> = {
  CREATE: 'bg-green-500/10 text-green-700 border-green-300 dark:text-green-300',
  UPDATE: 'bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-300',
  DELETE: 'bg-red-500/10 text-red-700 border-red-300 dark:text-red-300',
  LOGIN: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300',
  LOGOUT: 'bg-slate-500/10 text-slate-700 border-slate-300 dark:text-slate-300',
  STATUS_CHANGE: 'bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-300',
};

export default function AuditLogsUnifiedPage() {
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const { logs, total, totalPages, isLoading } = useAuditLogs({
    page,
    pageSize: 15,
    module: moduleFilter === 'ALL' ? undefined : moduleFilter,
    action: categoryFilter === 'ALL' ? undefined : categoryFilter,
    search: debouncedSearch || undefined,
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Auditoría"
          description="Registro inmutable de todas las acciones realizadas en el sistema"
        />

        {/* ── Filtros ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título o descripción…"
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los módulos</SelectItem>
              {Object.entries(MODULE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las acciones</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Tabla ───────────────────────────────── */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="hidden sm:table-cell">Módulo</TableHead>
                  <TableHead className="hidden md:table-cell">Acción</TableHead>
                  <TableHead className="hidden lg:table-cell">Usuario</TableHead>
                  <TableHead className="w-8"></TableHead>
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
                      No se encontraron registros con los filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLog(log as AuditLogEntry)}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium line-clamp-1">{log.title}</p>
                        {log.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{log.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{MODULE_LABELS[log.module] ?? log.module}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={CATEGORY_COLORS[log.category] ?? ''}>
                          {CATEGORY_LABELS[log.category] ?? log.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistema'}
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

          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? 'registro' : 'registros'}
            </p>
            {totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                isLoading={isLoading}
              />
            )}
          </div>
        </Card>
      </div>

      {/* ── Modal de detalle ─────────────────────── */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Detalle del registro
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-xs text-muted-foreground">Título</p>
                <p className="text-sm font-medium">{selectedLog.title}</p>
              </div>
              {selectedLog.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Descripción</p>
                  <p className="text-sm">{selectedLog.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha completa</p>
                  <p className="text-sm">
                    {format(new Date(selectedLog.createdAt), "EEEE, d 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IP / User-Agent</p>
                  <p className="text-xs truncate">
                    {selectedLog.ipAddress || 'Origen interno'} • {selectedLog.userAgent || 'N/D'}
                  </p>
                </div>
              </div>

              {selectedLog.details && (
                <div className="p-4 bg-muted/30 rounded-lg space-y-2 border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Payload técnico
                  </p>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.details?.coords && (
                <div className="p-4 bg-blue-500/10 border border-blue-300 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
                    <Shield className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase">Información de ubicación</p>
                  </div>
                  <p className="text-sm font-medium">
                    Lat: {selectedLog.details.coords.latitude} • Lng: {selectedLog.details.coords.longitude}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto"
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps?q=${selectedLog.details!.coords!.latitude},${selectedLog.details!.coords!.longitude}`,
                        '_blank'
                      )
                    }
                  >
                    Ver en Google Maps
                    <ExternalLink className="h-3 w-3 ml-1" />
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
