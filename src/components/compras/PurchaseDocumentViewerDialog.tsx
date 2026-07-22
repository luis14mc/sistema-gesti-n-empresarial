'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Swal from '@/lib/compras/orden/swal';
import {
  buildDocumentDownloadUrl,
  resolveViewerUrl,
  type ViewerDocument,
} from '@/types/compra-orden-documents';

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

export function PurchaseDocumentViewerDialog({
  open,
  onOpenChange,
  document,
}: PurchaseDocumentViewerDialogProps) {
  const [state, setState] = useState<ViewerState>({
    isLoading: false,
    error: null,
    viewUrl: null,
  });

  useEffect(() => {
    if (!open) {
      setState({ isLoading: false, error: null, viewUrl: null });
      return;
    }
    if (!document) {
      setState({ isLoading: false, error: 'Documento no disponible.', viewUrl: null });
      return;
    }

    const url = resolveViewerUrl(document);
    if (!url) {
      setState({
        isLoading: false,
        error: 'No se pudo determinar la URL del documento.',
        viewUrl: null,
      });
      return;
    }

    if (document.localUrl) {
      setState({ isLoading: false, error: null, viewUrl: url });
      return;
    }

    const controller = new AbortController();
    setState({ isLoading: true, error: null, viewUrl: null });
    void fetch(url, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo recuperar el documento adjunto.');
        setState({ isLoading: false, error: null, viewUrl: url });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'No se pudo recuperar el documento adjunto.';
        setState({ isLoading: false, error: message, viewUrl: null });
        void Swal.fire({ icon: 'error', title: 'No se pudo abrir el documento', text: message, confirmButtonText: 'Cerrar' });
      });
    return () => controller.abort();
  }, [open, document]);

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
            <iframe
              src={viewUrl}
              title={fileName}
              className="h-[75vh] w-full rounded-md border bg-white"
            />
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
