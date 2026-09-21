'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Search, FileText } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useOficios } from '@/hooks/useOficios';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { canAccess } from '@/lib/permissions';
import {
  OFICIO_DEPENDENCY_LABELS,
  OFICIO_DOCUMENT_KIND_LABELS,
  type OficioScope,
} from '@/lib/oficios-numbering';
import { OFICIO_STATUS_LABELS, type OficioStatus, type Role } from '@/types';
import { CorrespondenceRegisterDialog } from '@/components/oficios/CorrespondenceRegisterDialog';

type DirectionTab = 'ALL' | 'INCOMING' | 'OUTGOING';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-600 border-slate-200',
  PENDING_SIGNATURE: 'bg-violet-500/10 text-violet-700 border-violet-200',
  SIGNED: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
  SENT: 'bg-blue-500/10 text-blue-600 border-blue-200',
  ACKNOWLEDGED: 'bg-teal-500/10 text-teal-700 border-teal-200',
  RECEIVED: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  ASSIGNED: 'bg-orange-500/10 text-orange-700 border-orange-200',
  IN_PROCESS: 'bg-amber-500/10 text-amber-600 border-amber-200',
  RESPONDED: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-green-500/10 text-green-600 border-green-200',
  ARCHIVED: 'bg-muted text-muted-foreground border-border',
};

export function CorrespondenceHub({
  initialDependency,
  initialDirection,
}: {
  initialDependency?: OficioScope | '';
  initialDirection?: DirectionTab;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const role = (user?.role ?? 'USER') as Role;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [directionTab, setDirectionTab] = useState<DirectionTab>(
    initialDirection ?? (searchParams.get('direction') as DirectionTab) ?? 'ALL',
  );
  const [dependency, setDependency] = useState<string>(
    initialDependency ?? searchParams.get('dependency') ?? searchParams.get('scope') ?? 'ALL',
  );
  const [status, setStatus] = useState(searchParams.get('status') ?? 'ALL');
  const [year, setYear] = useState(searchParams.get('year') ?? String(new Date().getFullYear()));
  const [registerOpen, setRegisterOpen] = useState(false);

  const filters = useMemo(
    () => ({
      page,
      pageSize: 15,
      search: debouncedSearch || undefined,
      scope: dependency !== 'ALL' ? (dependency as OficioScope) : undefined,
      direction:
        directionTab === 'ALL'
          ? undefined
          : (directionTab as 'INCOMING' | 'OUTGOING'),
      status: status !== 'ALL' ? status : undefined,
      year: year !== 'ALL' ? year : undefined,
    }),
    [page, debouncedSearch, dependency, directionTab, status, year],
  );

  const { oficios, total, totalPages, isLoading, createOficio, isCreating } = useOficios(filters);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dependency, directionTab, status, year]);

  const canCreate = canAccess(role, 'oficios', 'create');

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Correspondencia"
          description="Registro unificado de entradas y salidas — CNI y Despacho de Promoción de Inversiones"
        >
          {canCreate ? (
            <Button onClick={() => setRegisterOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar correspondencia
            </Button>
          ) : null}
        </PageHeader>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['ALL', 'Todos'],
              ['INCOMING', 'Entradas'],
              ['OUTGOING', 'Salidas'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={directionTab === value ? 'default' : 'outline'}
              onClick={() => setDirectionTab(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por número, asunto, institución…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={dependency} onValueChange={setDependency}>
              <SelectTrigger>
                <SelectValue placeholder="Dependencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las dependencias</SelectItem>
                <SelectItem value="CNI">CNI</SelectItem>
                <SelectItem value="DESPACHO">Despacho</SelectItem>
                <SelectItem value="INTERNO">Internos / Memos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {Object.entries(OFICIO_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los años</SelectItem>
                {[0, 1, 2, 3].map((offset) => {
                  const y = String(new Date().getFullYear() - offset);
                  return (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card>
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : oficios.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-muted-foreground">
              <FileText className="h-10 w-10 opacity-40" />
              <p>No hay correspondencia con estos filtros.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Dependencia</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oficios.map((oficio) => (
                  <TableRow
                    key={oficio.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/oficios/${oficio.id}`)}
                  >
                    <TableCell className="font-medium">
                      <Link href={`/oficios/${oficio.id}`} className="hover:underline">
                        {oficio.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {oficio.type === 'INCOMING'
                          ? 'Entrada'
                          : oficio.type === 'INTERNAL_MEMO'
                            ? 'Memo'
                            : 'Salida'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {OFICIO_DEPENDENCY_LABELS[(oficio.scope as OficioScope) ?? 'CNI'] ??
                          oficio.scope ??
                          '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {oficio.subject}
                      {oficio.documentKind && oficio.documentKind !== 'OFICIO' ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({OFICIO_DOCUMENT_KIND_LABELS[oficio.documentKind as keyof typeof OFICIO_DOCUMENT_KIND_LABELS] ?? oficio.documentKind})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{oficio.institution}</TableCell>
                    <TableCell>
                      {format(new Date(oficio.oficioDate), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[oficio.status] ?? ''}>
                        {OFICIO_STATUS_LABELS[oficio.status as OficioStatus] ?? oficio.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {totalPages > 1 ? (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : null}

        <CorrespondenceRegisterDialog
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          onSubmit={async (data) => {
            await createOficio(data);
            setRegisterOpen(false);
          }}
          isSubmitting={isCreating}
        />
      </div>
    </MainLayout>
  );
}
