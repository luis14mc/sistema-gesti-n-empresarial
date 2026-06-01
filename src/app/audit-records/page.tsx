'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Filter, ClipboardCheck } from 'lucide-react';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/shared/Pagination';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const moduleLabels: Record<string, string> = {
  TICKETS: 'Tickets',
  OFICIOS: 'Oficios',
  EQUIPMENT: 'Equipos',
  INVENTORY: 'Inventario',
  PURCHASES: 'Compras',
  USERS: 'Usuarios',
  AUTH: 'Autenticación',
  TIME_ENTRIES: 'Asistencia',
  ASSIGNMENTS: 'Asignaciones',
};

const categoryColors: Record<string, string> = {
  CREATE: 'bg-green-500/10 text-green-600 border-green-200',
  UPDATE: 'bg-blue-500/10 text-blue-600 border-blue-200',
  DELETE: 'bg-red-500/10 text-red-600 border-red-200',
  LOGIN: 'bg-amber-500/10 text-amber-600 border-amber-200',
  LOGOUT: 'bg-slate-500/10 text-slate-600 border-slate-200',
  STATUS_CHANGE: 'bg-purple-500/10 text-purple-600 border-purple-200',
};

export default function AuditRecordsPage() {
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const { logs, total, totalPages, isLoading } = useAuditLogs({
    module: moduleFilter === 'ALL' ? undefined : moduleFilter,
    page,
    pageSize: 20,
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Auditoría"
          description="Registro de actividades del sistema"
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todos los módulos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {Object.entries(moduleLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="hidden sm:table-cell">Módulo</TableHead>
                  <TableHead className="hidden md:table-cell">Categoría</TableHead>
                  <TableHead className="hidden lg:table-cell">Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No se encontraron registros de auditoría
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium line-clamp-1">{log.title}</p>
                        {log.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {log.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">
                          {moduleLabels[log.module] ?? log.module}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className={categoryColors[log.category] ?? ''}
                        >
                          {log.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {log.user
                          ? `${log.user.firstName} ${log.user.lastName}`
                          : 'Sistema'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
