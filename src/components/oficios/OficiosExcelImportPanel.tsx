'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { sileo } from 'sileo';
import { Download, Loader2, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OficioImportPreviewResult } from '@/modules/oficios/import-export/types';

type RowFilter = 'all' | 'ok' | 'error' | 'duplicate';

export function OficiosExcelImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OficioImportPreviewResult | null>(null);
  const [filter, setFilter] = useState<RowFilter>('all');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'import'>('skip');
  const [lastUsedSequenceOverrides, setLastUsedSequenceOverrides] = useState<Record<string, number>>({});
  const [batchId, setBatchId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    if (filter === 'all') return preview.rows;
    return preview.rows.filter((row) => row.status === filter);
  }, [preview, filter]);

  const runPreview = async () => {
    if (!file) {
      sileo.error({ title: 'Seleccione un archivo XLSX' });
      return;
    }
    setLoadingPreview(true);
    setBatchId(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/oficios/import/preview', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? json.message ?? 'Error en vista previa');
      setPreview(json.data);
      const overrides: Record<string, number> = {};
      for (const item of json.data.numbering as OficioImportPreviewResult['numbering']) {
        overrides[item.key] = item.lastUsedSequence;
      }
      setLastUsedSequenceOverrides(overrides);
      sileo.success({ title: 'Vista previa lista' });
    } catch (error) {
      sileo.error({ title: 'Vista previa fallida', description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoadingPreview(false);
    }
  };

  const runCommit = async () => {
    if (!file || !preview) return;
    setCommitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append(
        'payload',
        JSON.stringify({ duplicates: duplicatePolicy, lastUsedSequenceOverrides }),
      );
      const res = await fetch('/api/oficios/import/commit', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? json.message ?? 'Error al importar');
      setBatchId(json.data.batchId);
      sileo.success({
        title: 'Importación completada',
        description: `${json.data.imported} oficios importados`,
      });
    } catch (error) {
      sileo.error({ title: 'Importación fallida', description: error instanceof Error ? error.message : undefined });
    } finally {
      setCommitting(false);
    }
  };

  if (batchId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Importación histórica completada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lote <span className="font-mono">{batchId}</span>. Puede subir PDFs asociados desde el detalle del lote.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/oficios/importar?batchId=${batchId}`}>Ver lote</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/oficios">Ir a correspondencia</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5" />
            Plantilla Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                const res = await fetch('/api/oficios/import/template');
                if (!res.ok) throw new Error('No se pudo descargar la plantilla');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = 'Plantilla_Correspondencia_CNI.xlsx';
                anchor.click();
                URL.revokeObjectURL(url);
              } catch (error) {
                sileo.error({
                  title: 'Descarga fallida',
                  description: error instanceof Error ? error.message : undefined,
                });
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar plantilla
          </Button>
          <div className="flex flex-1 min-w-[240px] flex-col gap-2">
            <Label htmlFor="oficio-xlsx">Archivo .xlsx (máx. 5 MB, 2000 filas)</Label>
            <Input
              id="oficio-xlsx"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </div>
          <Button onClick={runPreview} disabled={!file || loadingPreview}>
            {loadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Vista previa
          </Button>
        </CardContent>
      </Card>

      {preview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Filas" value={preview.totalRows} />
            <StatCard label="Válidas" value={preview.validCount} />
            <StatCard label="Errores" value={preview.errorCount} />
            <StatCard label="Duplicados" value={preview.duplicateCount} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={(value) => setFilter(value as RowFilter)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar filas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="ok">Válidas</SelectItem>
                <SelectItem value="error">Errores</SelectItem>
                <SelectItem value="duplicate">Duplicados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={duplicatePolicy} onValueChange={(value) => setDuplicatePolicy(value as 'skip' | 'import')}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Duplicados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Omitir duplicados</SelectItem>
                <SelectItem value="import">Importar duplicados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vista previa por fila</CardTitle>
            </CardHeader>
            <CardContent className="max-h-72 overflow-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2">Fila</th>
                    <th className="py-2 pr-2">Estado</th>
                    <th className="py-2 pr-2">Número</th>
                    <th className="py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.row} className="border-b align-top">
                      <td className="py-2 pr-2 tabular-nums">{row.row}</td>
                      <td className="py-2 pr-2">
                        <Badge variant={row.status === 'ok' ? 'default' : row.status === 'duplicate' ? 'secondary' : 'destructive'}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">{row.number ?? '—'}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {row.errors?.map((error) => `${error.field}: ${error.message}`).join('; ')}
                        {row.duplicateOf ? `Duplicado de ${row.duplicateOf.number}` : null}
                        {row.warnings?.join('; ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {preview.numbering.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Numeración por dependencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {preview.numbering.map((item) => (
                  <div key={item.key} className="grid gap-2 md:grid-cols-[1fr_160px] md:items-end">
                    <div>
                      <p className="font-medium">
                        {item.dependency} · {item.year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Último número importado: {item.lastImportedNumber}
                        {item.nextOficioNumber !== '—' ? (
                          <>
                            {' '}
                            · El próximo oficio será: {item.nextOficioNumber}
                          </>
                        ) : null}
                      </p>
                      {item.patternWarnings.slice(0, 2).map((warning) => (
                        <p key={warning} className="text-xs text-amber-600 dark:text-amber-400">
                          {warning}
                        </p>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <Label>Último número usado</Label>
                      <Input
                        type="number"
                        min={item.maxImportedSequence}
                        value={lastUsedSequenceOverrides[item.key] ?? item.lastUsedSequence}
                        onChange={(event) =>
                          setLastUsedSequenceOverrides((prev) => ({
                            ...prev,
                            [item.key]: Number.parseInt(event.target.value, 10) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Button
            onClick={runCommit}
            disabled={committing || preview.errorCount > 0 || preview.validCount === 0}
          >
            {committing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar importación
          </Button>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
