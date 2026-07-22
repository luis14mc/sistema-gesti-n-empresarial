'use client';

import Link from 'next/link';
import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import {
  Upload, FileText, Trash2, AlertTriangle, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Loader2, Download,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  OFICIO_DOCUMENT_TYPE_LABELS,
  OFICIO_STATUS_LABELS,
  type OficioStatus,
} from '@/types';

const SCOPES = [
  { value: 'INTERNO', label: 'Interno / Memo' },
  { value: 'CNI', label: 'Externo CNI' },
  { value: 'DESPACHO', label: 'Externo Despacho' },
] as const;

const DIRECTIONS = [
  { value: 'INCOMING', label: 'Ingresado' },
  { value: 'OUTGOING', label: 'Enviado' },
  { value: 'INTERNAL_MEMO', label: 'Memo interno' },
] as const;

const DOCUMENT_TYPES = [
  { value: 'OFICIO_PRINCIPAL', label: 'Oficio principal' },
  { value: 'ANEXO', label: 'Anexo' },
  { value: 'RESPUESTA', label: 'Respuesta' },
  { value: 'ACUSE_RECIBO', label: 'Acuse de recibo' },
  { value: 'SOPORTE', label: 'Soporte' },
  { value: 'OTRO', label: 'Otro' },
] as const;

interface BatchItem {
  id: string;
  file: File;
  fileSize: number;
  number: string;
  scope: string;
  type: string;
  recipient: string;
  institution: string;
  preparedBy: string;
  motivo: string;
  oficioDate: string;
  status: OficioStatus;
  documentType: string;
  error?: string;
  warning?: string;
}

interface BatchResult {
  rowIndex: number;
  fileName: string;
  status: 'IMPORTED' | 'SKIPPED' | 'ERROR';
  oficioId?: string;
  number?: string;
  duplicates?: Array<{ reason: string }>;
  error?: string;
}

interface BatchSummary {
  batchId: string;
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  results: BatchResult[];
}

const DEFAULT_ITEM = (file: File): BatchItem => ({
  id: crypto.randomUUID(),
  file,
  fileSize: file.size,
  number: '',
  scope: 'INTERNO',
  type: 'INCOMING',
  recipient: '',
  institution: '',
  preparedBy: '',
  motivo: '',
  oficioDate: '',
  status: 'RECEIVED',
  documentType: 'OFICIO_PRINCIPAL',
});

const MAX_FILES = 25;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export default function ImportarOficioPage() {
  const router = useRouter();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [notes, setNotes] = useState('');

  const addFiles = useCallback((files: FileList | File[]) => {
    const accepted: BatchItem[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (items.length + accepted.length >= MAX_FILES) {
        rejected.push(`${file.name} (límite alcanzado)`);
        continue;
      }
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
      if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
        rejected.push(`${file.name} (formato no permitido)`);
        continue;
      }
      if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (tamaño inválido)`);
        continue;
      }
      accepted.push(DEFAULT_ITEM(file));
    }

    if (accepted.length > 0) {
      setItems((prev) => [...prev, ...accepted]);
    }
    if (rejected.length > 0) {
      sileo.warning({ title: 'Algunos archivos no se agregaron', description: rejected.join(', ') });
    }
    if (accepted.length > 0 && rejected.length === 0) {
      sileo.success({ title: `${accepted.length} archivo(s) agregado(s)` });
    }
    setSummary(null);
  }, [items.length]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const validate = (): string | null => {
    if (items.length === 0) return 'Agrega al menos un archivo';
    for (const [idx, item] of items.entries()) {
      if (!item.number.trim()) return `Fila ${idx + 1}: falta número`;
      if (!item.motivo.trim()) return `Fila ${idx + 1}: falta motivo`;
      if (!item.oficioDate) return `Fila ${idx + 1}: falta fecha original`;
      if (!item.recipient.trim()) return `Fila ${idx + 1}: falta destinatario`;
      if (!item.institution.trim()) return `Fila ${idx + 1}: falta institución`;
      if (!item.preparedBy.trim()) return `Fila ${idx + 1}: falta elaborado por`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      sileo.error({ title: 'Datos incompletos', description: err });
      return;
    }
    setSubmitting(true);
    setSummary(null);
    try {
      const fd = new FormData();
      for (const item of items) fd.append('files', item.file);
      fd.append('payload', JSON.stringify({
        items: items.map((i) => ({
          number: i.number,
          scope: i.scope,
          type: i.type,
          recipient: i.recipient,
          institution: i.institution,
          preparedBy: i.preparedBy,
          motivo: i.motivo,
          oficioDate: i.oficioDate,
          status: i.status,
          documentType: i.documentType,
        })),
        notes: notes || undefined,
      }));

      const res = await fetch('/api/oficios/import/batch', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar batch');

      setSummary(data as BatchSummary);
      setItems([]);
      setNotes('');

      if (data.errors === 0 && data.skipped === 0) {
        sileo.success({ title: 'Batch importado', description: `${data.imported} archivo(s)` });
      } else {
        sileo.warning({
          title: 'Batch procesado con observaciones',
          description: `${data.imported} importados, ${data.skipped} omitidos, ${data.errors} errores`,
        });
      }
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al enviar batch',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalSize = useMemo(
    () => items.reduce((sum, i) => sum + i.fileSize, 0),
    [items],
  );

  if (summary) {
    return (
      <MainLayout>
        <PageHeader
          title="Resultado del batch"
          description={`${summary.imported} importados · ${summary.skipped} omitidos · ${summary.errors} errores`}
        >
          <Button asChild variant="outline">
            <Link href="/oficios/todos"><FileText className="h-4 w-4 mr-2" /> Ir al repositorio</Link>
          </Button>
        </PageHeader>

        <BatchResultCards summary={summary} />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Detalle por archivo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">#</th>
                  <th className="px-4 py-2 text-left font-medium">Archivo</th>
                  <th className="px-4 py-2 text-left font-medium">No. Oficio</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-left font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {summary.results.map((r) => (
                  <tr key={r.rowIndex} className="border-b">
                    <td className="px-4 py-2 tabular-nums">{r.rowIndex + 1}</td>
                    <td className="px-4 py-2 truncate max-w-[260px]" title={r.fileName}>{r.fileName}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {r.oficioId ? (
                        <Link href={`/oficios/${r.oficioId}`} className="text-primary hover:underline">
                          {r.number}
                        </Link>
                      ) : r.number ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {r.error && <span className="text-destructive">{r.error}</span>}
                      {r.duplicates?.length && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {r.duplicates.map((d) => d.reason).join('; ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex gap-2 mt-6">
          <Button asChild>
            <Link href="/oficios/importar">Importar más oficios</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/oficios/todos">Ver repositorio</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Importar oficios"
        description="Carga individual o por lotes — conserva número y fecha original, no genera correlativo"
      >
        <Button asChild variant="outline">
          <Link href="/oficios/todos"><FileText className="h-4 w-4 mr-2" /> Repositorio</Link>
        </Button>
      </PageHeader>

      <DropZone
        isDragging={isDragging}
        onDragChange={setIsDragging}
        onFiles={addFiles}
        disabled={items.length >= MAX_FILES || submitting}
      />

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-6 mb-3">
            <div>
              <h2 className="text-base font-semibold">
                {items.length} archivo{items.length === 1 ? '' : 's'} seleccionado{items.length === 1 ? '' : 's'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Tamaño total: {formatBytes(totalSize)} · Completa la metadata de cada fila antes de enviar
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setItems([])}
                disabled={submitting}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Vaciar todo
              </Button>
            </div>
          </div>

          <BatchItemsTable
            items={items}
            onUpdate={updateItem}
            onRemove={removeItem}
            disabled={submitting}
          />

          <Card className="mt-6">
            <CardContent className="pt-6 space-y-3">
              <Label htmlFor="batch-notes">Notas del lote (opcional)</Label>
              <Textarea
                id="batch-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Información interna sobre el origen del lote, autorización, etc."
                rows={2}
                disabled={submitting}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setItems([])}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…</>
                : <><Upload className="h-4 w-4 mr-2" /> Importar {items.length} oficio(s)</>}
            </Button>
          </div>
        </>
      )}
    </MainLayout>
  );
}

function DropZone({
  isDragging, onDragChange, onFiles, disabled,
}: {
  isDragging: boolean;
  onDragChange: (v: boolean) => void;
  onFiles: (files: FileList | File[]) => void;
  disabled: boolean;
}) {
  return (
    <Card
      className={cn(
        'border-2 border-dashed transition-colors',
        isDragging && 'border-primary bg-primary/5',
        disabled && 'opacity-50 pointer-events-none',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) onDragChange(true);
      }}
      onDragLeave={() => onDragChange(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragChange(false);
        if (!disabled && e.dataTransfer.files.length > 0) {
          onFiles(e.dataTransfer.files);
        }
      }}
    >
      <CardContent className="py-16 text-center">
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-base font-medium mb-1">
          Arrastra archivos aquí o selecciónalos
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          PDF, JPG, JPEG, PNG · Máximo 10 MB por archivo · Hasta {MAX_FILES} archivos por lote
        </p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept={ACCEPT}
            disabled={disabled}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onFiles(e.target.files);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
          <Button asChild>
            <span className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" /> Seleccionar archivos
            </span>
          </Button>
        </label>
      </CardContent>
    </Card>
  );
}

function BatchItemsTable({
  items, onUpdate, onRemove, disabled,
}: {
  items: BatchItem[];
  onUpdate: (id: string, patch: Partial<BatchItem>) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Metadata por archivo</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((item, idx) => (
            <BatchItemRow
              key={item.id}
              item={item}
              rowIndex={idx}
              onUpdate={onUpdate}
              onRemove={onRemove}
              disabled={disabled}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BatchItemRow({
  item, rowIndex, onUpdate, onRemove, disabled,
}: {
  item: BatchItem;
  rowIndex: number;
  onUpdate: (id: string, patch: Partial<BatchItem>) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const filled = item.number && item.motivo && item.oficioDate
    && item.recipient && item.institution && item.preparedBy;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? 'Expandir' : 'Contraer'}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <span className="tabular-nums text-xs text-muted-foreground w-6">#{rowIndex + 1}</span>
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.file.name}</div>
          <div className="text-xs text-muted-foreground">
            {formatBytes(item.fileSize)} · {item.file.type || 'tipo desconocido'}
          </div>
        </div>
        {filled ? (
          <Badge variant="outline" className="text-[10px] font-normal text-green-600 border-green-600/30">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Completo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] font-normal text-amber-600 border-amber-600/30">
            <AlertTriangle className="h-3 w-3 mr-1" /> Pendiente
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(item.id)}
          disabled={disabled}
          aria-label="Eliminar fila"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {!collapsed && (
        <div className="mt-3 ml-7 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Cell label="No. Oficio *">
            <Input value={item.number} onChange={(e) => onUpdate(item.id, { number: e.target.value })} disabled={disabled} />
          </Cell>
          <Cell label="Submódulo">
            <Select value={item.scope} onValueChange={(v) => onUpdate(item.id, { scope: v })} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Cell>
          <Cell label="Dirección">
            <Select value={item.type} onValueChange={(v) => onUpdate(item.id, { type: v })} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Cell>
          <Cell label="Tipo doc.">
            <Select value={item.documentType} onValueChange={(v) => onUpdate(item.id, { documentType: v })} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Cell>
          <Cell label="Destinatario *" className="md:col-span-2">
            <Input value={item.recipient} onChange={(e) => onUpdate(item.id, { recipient: e.target.value })} disabled={disabled} />
          </Cell>
          <Cell label="Institución *" className="md:col-span-2">
            <Input value={item.institution} onChange={(e) => onUpdate(item.id, { institution: e.target.value })} disabled={disabled} />
          </Cell>
          <Cell label="Elaborado por *" className="md:col-span-2">
            <Input value={item.preparedBy} onChange={(e) => onUpdate(item.id, { preparedBy: e.target.value })} disabled={disabled} />
          </Cell>
          <Cell label="Estado inicial">
            <Select value={item.status} onValueChange={(v) => onUpdate(item.id, { status: v as OficioStatus })} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(OFICIO_STATUS_LABELS) as OficioStatus[])
                  .map((s) => <SelectItem key={s} value={s}>{OFICIO_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Cell>
          <Cell label="Fecha original *" className="md:col-span-2">
            <Input type="date" value={item.oficioDate} onChange={(e) => onUpdate(item.id, { oficioDate: e.target.value })} disabled={disabled} />
          </Cell>
          <Cell label="Motivo *" className="md:col-span-4">
            <Textarea
              rows={2}
              value={item.motivo}
              onChange={(e) => onUpdate(item.id, { motivo: e.target.value })}
              disabled={disabled}
              placeholder="Resumen del asunto"
            />
          </Cell>
        </div>
      )}
    </div>
  );
}

function Cell({
  label, children, className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: BatchResult['status'] }) {
  if (status === 'IMPORTED') {
    return <Badge className="font-normal bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Importado</Badge>;
  }
  if (status === 'SKIPPED') {
    return <Badge variant="secondary" className="font-normal"><AlertTriangle className="h-3 w-3 mr-1" /> Omitido</Badge>;
  }
  return <Badge variant="destructive" className="font-normal"><XCircle className="h-3 w-3 mr-1" /> Error</Badge>;
}

function BatchResultCards({ summary }: { summary: BatchSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SummaryCard label="Total" value={summary.total} variant="default" />
      <SummaryCard label="Importados" value={summary.imported} variant="success" />
      <SummaryCard label="Omitidos" value={summary.skipped} variant="warning" />
      <SummaryCard label="Errores" value={summary.errors} variant="destructive" />
    </div>
  );
}

function SummaryCard({
  label, value, variant,
}: {
  label: string;
  value: number;
  variant: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const colorMap = {
    default: 'border-border',
    success: 'border-green-600/30 bg-green-50 dark:bg-green-950/20',
    warning: 'border-amber-600/30 bg-amber-50 dark:bg-amber-950/20',
    destructive: 'border-destructive/30 bg-destructive/5',
  };
  return (
    <Card className={colorMap[variant]}>
      <CardContent className="pt-6 text-center">
        <div className="text-3xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
