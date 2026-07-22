'use client';

import Link from 'next/link';
import { Search, FileText, Image as ImageIcon, Filter } from 'lucide-react';
import { useState, useMemo, useDeferredValue } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/shared/Pagination';
import { OficioStatusBadge } from '@/components/oficios/OficioStatusBadge';
import { useOficiosSearch } from '@/hooks/useOficios';
import {
  OFICIO_DOCUMENT_TYPE_LABELS,
  OFICIO_RECORD_SOURCE_LABELS,
  OFICIO_STATUS_LABELS,
  OFICIO_TYPE_LABELS,
  type Oficio,
  type OficioRecordSource,
  type OficioStatus,
  type OficioType,
} from '@/types';
import { cn } from '@/lib/utils';

const SCOPES = [
  { value: 'INTERNO', label: 'Interno' },
  { value: 'CNI', label: 'CNI' },
  { value: 'DESPACHO', label: 'Despacho' },
] as const;

const MOVEMENTS = [
  { value: 'INGRESADO', label: 'Ingresado', type: 'INCOMING' as OficioType },
  { value: 'ENVIADO', label: 'Enviado', type: 'OUTGOING' as OficioType },
  { value: 'INTERNO', label: 'Memo interno', type: 'INTERNAL_MEMO' as OficioType },
] as const;

export default function TodosOficiosPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [movement, setMovement] = useState<string>('');
  const [recordSource, setRecordSource] = useState<string>('');
  const [hasDocument, setHasDocument] = useState<string>('');
  const [year, setYear] = useState<string>('');

  const deferredQ = useDeferredValue(q);
  const filters = useMemo(
    () => ({
      q: deferredQ || undefined,
      scope: scope || undefined,
      status: status || undefined,
      type: movement ? MOVEMENTS.find((m) => m.value === movement)?.type : undefined,
      recordSource: recordSource || undefined,
      hasDocument: hasDocument || undefined,
      year: year || undefined,
      page,
      pageSize: 25,
    }),
    [deferredQ, scope, status, movement, recordSource, hasDocument, year, page],
  );

  const { oficios, totalPages, total, isLoading } = useOficiosSearch(filters);

  const resetFilters = () => {
    setQ(''); setScope(''); setStatus(''); setMovement('');
    setRecordSource(''); setHasDocument(''); setYear(''); setPage(1);
  };

  const hasFilters =
    q || scope || status || movement || recordSource || hasDocument || year;

  return (
    <MainLayout>
      <PageHeader
        title="Todos los oficios"
        description="Bandeja global del repositorio documental — búsqueda por metadata"
      >
        <Button asChild variant="outline">
          <Link href="/oficios/importar"><FileText className="h-4 w-4 mr-2" /> Importar oficios</Link>
        </Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, asunto, destinatario, institución, elaborado por, comentarios o nombre de archivo…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <FilterSelect label="Submódulo" value={scope} onChange={setScope}
              options={SCOPES.map(s => ({ value: s.value, label: s.label }))} />
            <FilterSelect label="Movimiento" value={movement} onChange={setMovement}
              options={MOVEMENTS.map(m => ({ value: m.value, label: m.label }))} />
            <FilterSelect label="Estado" value={status} onChange={setStatus}
              options={(Object.keys(OFICIO_STATUS_LABELS) as OficioStatus[])
                .map(s => ({ value: s, label: OFICIO_STATUS_LABELS[s] }))} />
            <FilterSelect label="Origen" value={recordSource} onChange={setRecordSource}
              options={(Object.keys(OFICIO_RECORD_SOURCE_LABELS) as OficioRecordSource[])
                .map(s => ({ value: s, label: OFICIO_RECORD_SOURCE_LABELS[s] }))} />
            <FilterSelect label="Documento" value={hasDocument} onChange={setHasDocument}
              options={[
                { value: 'true', label: 'Con documento' },
                { value: 'false', label: 'Sin documento' },
              ]} />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Año</label>
              <Input
                type="number"
                placeholder="YYYY"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => { setYear(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {hasFilters && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {isLoading ? 'Buscando…' : `${total} resultado${total === 1 ? '' : 's'}`}
              </span>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <Filter className="h-3.5 w-3.5 mr-1" /> Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Oficio</TableHead>
                <TableHead>Submódulo</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead>Institución</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Elaborado por</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Cargando…</TableCell></TableRow>
              ) : oficios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    {hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay oficios registrados.'}
                  </TableCell>
                </TableRow>
              ) : (
                oficios.map((o: Oficio) => <OficioRow key={o.id} oficio={o} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </MainLayout>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value || '__ALL__'} onValueChange={(v) => onChange(v === '__ALL__' ? '' : v)}>
        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__ALL__">Todos</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function OficioRow({ oficio }: { oficio: Oficio }) {
  const primaryDoc = oficio.documents?.find((d) => d.isPrimary) ?? oficio.documents?.[0];
  const isImage = primaryDoc?.mimeType?.startsWith('image/');
  const scopeLabel =
    oficio.scope === 'INTERNO' ? 'Interno'
    : oficio.scope === 'CNI' ? 'CNI'
    : oficio.scope === 'DESPACHO' ? 'Despacho'
    : '—';

  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="font-medium">
        <Link href={`/oficios/${oficio.id}`} className="block hover:underline">
          <div className="flex flex-col">
            <span>{oficio.number}</span>
            {oficio.systemNumber && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {oficio.systemNumber}
              </span>
            )}
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-normal">{scopeLabel}</Badge>
      </TableCell>
      <TableCell className="text-xs">{OFICIO_TYPE_LABELS[oficio.type]}</TableCell>
      <TableCell className="max-w-[200px] truncate" title={oficio.institution ?? ''}>
        {oficio.institution ?? '—'}
      </TableCell>
      <TableCell className="max-w-[180px] truncate" title={oficio.recipient ?? ''}>
        {oficio.recipient ?? '—'}
      </TableCell>
      <TableCell className="max-w-[260px] truncate" title={oficio.subject}>
        {oficio.subject}
      </TableCell>
      <TableCell className="text-xs">{oficio.preparedBy ?? '—'}</TableCell>
      <TableCell className="text-xs tabular-nums">
        {new Date(oficio.oficioDate).toLocaleDateString('es-HN')}
      </TableCell>
      <TableCell>
        {primaryDoc ? (
          <Link
            href={`/oficios/${oficio.id}`}
            className={cn('inline-flex items-center gap-1 text-xs hover:underline', 'text-primary')}
            title={primaryDoc.originalName}
          >
            {isImage ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            <span className="truncate max-w-[120px]">{primaryDoc.originalName}</span>
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">Sin documento</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <OficioStatusBadge status={oficio.status} />
          {oficio.recordSource !== 'SYSTEM_CREATED' && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {OFICIO_RECORD_SOURCE_LABELS[oficio.recordSource]}
            </Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
