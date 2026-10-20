'use client';

import { useMemo } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  buildDocumentDownloadUrl,
  resolveViewerUrl,
  type ViewerDocument,
} from '@/types/compra-orden-documents';
import { PurchaseOrderPdfViewer } from '@/components/compras/PurchaseOrderPdfViewer';

type ViewerState = {
  isLoading: boolean;
  error: string | null;
  viewUrl: string | null;
};

interface PurchaseDocumentViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: ViewerDocument | null;
}

function isPdf(mimeType: string) {
  return mimeType === 'application/pdf';
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

function resolveViewerState(open: boolean, document: ViewerDocument | null): ViewerState {
  if (!open) {
    return { isLoading: false, error: null, viewUrl: null };
  }
  if (!document) {
    return { isLoading: false, error: 'Documento no disponible.', viewUrl: null };
  }
  const url = resolveViewerUrl(document);
  if (!url) {
    return {
      isLoading: false,
      error: 'No se pudo determinar la URL del documento.',
      viewUrl: null,
    };
  }
  return { isLoading: false, error: null, viewUrl: url };
}

export function PurchaseDocumentViewerDialog({
  open,
  onOpenChange,
  document,
}: PurchaseDocumentViewerDialogProps) {
  const state = useMemo(() => resolveViewerState(open, document), [open, document]);

  const fileName = document?.originalName ?? 'Documento';
  const downloadUrl =
    document?.localUrl ??
    (document?.orderId && document?.id
      ? buildDocumentDownloadUrl(document.orderId, document.id)
      : null);

  const { isLoading, error, viewUrl } = state;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-[90vw] w-[90vw] flex-col p-4">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{fileName}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/20">
          {isLoading ? (
            <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
              Cargando documento...
            </div>
          ) : error ? (
            <div className="flex h-[70vh] items-center justify-center text-destructive">
              {error}
            </div>
          ) : viewUrl && isPdf(document?.mimeType ?? '') ? (
            document?.localUrl ? (
              <iframe
                src={viewUrl}
                title={fileName}
                className="h-[75vh] w-full rounded-md border bg-white"
              />
            ) : (
              <PurchaseOrderPdfViewer
                srcUrl={viewUrl}
                title={fileName}
                minHeightClass="min-h-[75vh]"
              />
            )
          ) : viewUrl && isImage(document?.mimeType ?? '') ? (
            <img
              src={viewUrl}
              alt={fileName}
              className="mx-auto max-h-[75vh] max-w-full object-contain"
            />
          ) : (
            <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
              Vista previa no disponible.
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap justify-end gap-2 pt-2">
          {downloadUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} download={fileName}>
                <Download className="mr-1 h-4 w-4" />
                Descargar
              </a>
            </Button>
          )}
          {viewUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" />
                Abrir en nueva pestaña
              </a>
            </Button>
          )}
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
