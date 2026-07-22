'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, ImageIcon, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { COMPRA_TIPO_ADJUNTO_LABELS } from '@/lib/compras/constants';
import type { CompraAdjunto } from '@/types/compras';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

interface CompraAdjuntosPanelProps {
  adjuntos: CompraAdjunto[];
  uploadSlot?: React.ReactNode;
}

export function CompraAdjuntosPanel({ adjuntos, uploadSlot }: CompraAdjuntosPanelProps) {
  const [selectedId, setSelectedId] = useState(adjuntos[0]?.id ?? '');

  const selected = adjuntos.find((a) => a.id === selectedId) ?? adjuntos[0];

  if (adjuntos.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay adjuntos en esta orden.
        </div>
        {uploadSlot}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {adjuntos.map((adjunto) => {
          const active = adjunto.id === (selected?.id ?? '');
          return (
            <li key={adjunto.id}>
              <button
                type="button"
                onClick={() => setSelectedId(adjunto.id)}
                className={`w-full flex items-center justify-between rounded-md border p-3 text-left text-sm transition-colors ${
                  active ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {isPdf(adjunto.mimeType) ? (
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                  ) : isImage(adjunto.mimeType) ? (
                    <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Paperclip className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {COMPRA_TIPO_ADJUNTO_LABELS[adjunto.tipoAdjunto] ?? adjunto.tipoAdjunto}: {adjunto.nombre}
                  </span>
                </span>
                <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                  {formatFileSize(adjunto.size)}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && <AdjuntoViewer adjunto={selected} />}

      {uploadSlot}
    </div>
  );
}

function AdjuntoViewer({ adjunto }: { adjunto: CompraAdjunto }) {
  const pdf = isPdf(adjunto.mimeType);
  const image = isImage(adjunto.mimeType);

  return (
    <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{adjunto.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {COMPRA_TIPO_ADJUNTO_LABELS[adjunto.tipoAdjunto] ?? adjunto.tipoAdjunto}
            {adjunto.uploadedBy
              ? ` · ${adjunto.uploadedBy.firstName} ${adjunto.uploadedBy.lastName}`
              : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={adjunto.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={adjunto.url} download={adjunto.nombre}>
              <Download className="h-3.5 w-3.5 mr-1" /> Descargar
            </a>
          </Button>
        </div>
      </div>

      <Separator />

      <div className="rounded-md overflow-hidden border bg-background">
        {pdf && (
          <iframe
            src={adjunto.url}
            title={adjunto.nombre}
            className="w-full h-[min(70vh,560px)]"
          />
        )}
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={adjunto.url}
            alt={adjunto.nombre}
            className="w-full max-h-[min(70vh,560px)] object-contain bg-muted/20"
          />
        )}
        {!pdf && !image && (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
            <FileText className="h-10 w-10" />
            <p>Vista previa no disponible para este formato.</p>
            <Button variant="outline" size="sm" asChild>
              <a href={adjunto.url} target="_blank" rel="noopener noreferrer">
                Abrir archivo
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
