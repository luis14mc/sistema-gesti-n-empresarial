'use client';

import { ExternalLink, Download, FileText, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { OficioAttachment } from '@/types';
import {
  formatFileSize,
  isImageAttachment,
  isPdfAttachment,
} from '@/lib/oficios-attachments';

interface OficioDocumentViewerProps {
  attachments: OficioAttachment[];
}

export function OficioDocumentViewer({ attachments }: OficioDocumentViewerProps) {
  if (attachments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin documento adjunto
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {attachments.map((attachment, index) => (
        <DocumentPreview key={`${attachment.url}-${index}`} attachment={attachment} />
      ))}
    </div>
  );
}

function DocumentPreview({ attachment }: { attachment: OficioAttachment }) {
  const isPdf = isPdfAttachment(attachment);
  const isImage = isImageAttachment(attachment);

  return (
    <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {isPdf ? (
              <FileText className="h-5 w-5 text-primary" />
            ) : (
              <ImageIcon className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{attachment.originalName}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">
                {isPdf ? 'PDF' : 'Imagen'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(attachment.size)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Abrir
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={attachment.url} download={attachment.originalName}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Descargar
            </a>
          </Button>
        </div>
      </div>

      <Separator />

      <div className="rounded-lg overflow-hidden border bg-background">
        {isPdf && (
          <iframe
            src={attachment.url}
            title={attachment.originalName}
            className="w-full h-[min(70vh,520px)]"
          />
        )}
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.url}
            alt={attachment.originalName}
            className="w-full max-h-[min(70vh,520px)] object-contain bg-muted/30"
          />
        )}
        {!isPdf && !isImage && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Vista previa no disponible para este tipo de archivo.
          </div>
        )}
      </div>
    </div>
  );
}
