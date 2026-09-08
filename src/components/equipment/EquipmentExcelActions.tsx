'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { EquipmentFilters } from '@/types';
import type { EquipmentImportResponse } from '@/services/equipment.service';
import { sileo } from 'sileo';

type ImportResult = EquipmentImportResponse['data'];

function exportUrl(filters?: EquipmentFilters): string {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);
  const query = params.toString();
  return `/api/equipment/export${query ? `?${query}` : ''}`;
}

export function EquipmentExcelActions({
  canImport,
  canExport,
  filters,
  onImport,
  importing,
}: {
  canImport: boolean;
  canExport: boolean;
  filters: EquipmentFilters;
  onImport: (file: File) => Promise<ImportResult>;
  importing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runImport = async () => {
    if (!file) return;
    try {
      const response = await onImport(file);
      setResult(response);
      if (response.imported > 0) sileo.success({ title: 'Importación completada', description: `${response.imported} equipos importados.` });
      if (response.errors.length > 0) sileo.warning({ title: 'Importación con observaciones', description: `${response.skipped} filas omitidas.` });
    } catch {
      sileo.error({ title: 'No se pudo importar', description: 'Verifique que el archivo corresponda a la plantilla oficial.' });
    }
  };

  return (
    <>
      {canImport ? (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Upload className="mr-2 h-4 w-4" /> Importar Excel
        </Button>
      ) : null}
      {canExport ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar Excel</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href="/api/equipment/export">Exportar todo el inventario</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={exportUrl(filters)}>Exportar resultados filtrados</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {canImport ? (
        <Button type="button" variant="ghost" asChild>
          <Link href="/api/equipment/import/template"><FileSpreadsheet className="mr-2 h-4 w-4" /> Descargar plantilla</Link>
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setFile(null); setResult(null); }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar inventario desde Excel</DialogTitle>
            <DialogDescription>Use la plantilla oficial. Solo se aceptan archivos .xlsx de hasta 5 MB y 1000 filas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="link" className="h-auto p-0" asChild><Link href="/api/equipment/import/template">Descargar plantilla</Link></Button>
            <button
              type="button"
              className="flex min-h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center hover:bg-muted/40"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] ?? null); setResult(null); }}
            >
              <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
              <span className="font-medium">{file?.name ?? 'Seleccione o arrastre un archivo .xlsx'}</span>
              <span className="mt-1 text-xs text-muted-foreground">No se almacenará el archivo original.</span>
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); }} />

            {result ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Summary label="Total filas" value={result.totalRows} />
                  <Summary label="Importadas" value={result.imported} />
                  <Summary label="Omitidas" value={result.skipped} />
                  <Summary label="Errores" value={result.errors.length} />
                </div>
                {result.errors.length ? (
                  <div className="max-h-56 overflow-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Fila</th><th className="p-2 text-left">Campo</th><th className="p-2 text-left">Error</th></tr></thead>
                      <tbody>{result.errors.map((error, index) => <tr key={`${error.row}-${error.code}-${index}`} className="border-t"><td className="p-2">{error.row}</td><td className="p-2">{error.field}</td><td className="p-2">{error.message}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
            <Button type="button" disabled={!file || importing} onClick={runImport}>{importing ? 'Procesando…' : 'Importar archivo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{value}</p></div>;
}
