'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchPdfBlobUrl } from '@/lib/compras/print-pdf';
import { cn } from '@/lib/utils';

type ViewerState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; blobUrl: string }
  | { phase: 'error'; message: string };

interface PurchaseOrderPdfViewerProps {
  /** Authenticated view URL (same origin). */
  srcUrl: string | null;
  title?: string;
  className?: string;
  /** Minimum height of the viewer area. */
  minHeightClass?: string;
}

export function PurchaseOrderPdfViewer({
  srcUrl,
  title = 'PDF de la orden de compra',
  className,
  minHeightClass = 'min-h-[min(70vh,720px)]',
}: PurchaseOrderPdfViewerProps) {
  const [state, setState] = useState<ViewerState>({ phase: 'idle' });
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!srcUrl) {
      setState({ phase: 'idle' });
      return undefined;
    }

    const controller = new AbortController();
    setState({ phase: 'loading' });

    void fetchPdfBlobUrl(srcUrl, { signal: controller.signal })
      .then((url) => {
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        blobRef.current = url;
        setState({ phase: 'ready', blobUrl: url });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error && error.message.startsWith('PDF_FETCH_FAILED')
            ? 'No se pudo cargar el PDF. Verifique su sesión e intente de nuevo.'
            : 'El archivo no es un PDF válido o no está disponible.';
        setState({ phase: 'error', message });
      });

    return () => {
      controller.abort();
      if (blobRef.current) {
        try {
          URL.revokeObjectURL(blobRef.current);
        } catch {
          /* ignore */
        }
        blobRef.current = null;
      }
    };
  }, [srcUrl]);

  if (!srcUrl) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-md border bg-muted/30',
        minHeightClass,
        className,
      )}
    >
      {state.phase === 'loading' ? (
        <div className="flex h-full min-h-[inherit] items-center justify-center text-sm text-muted-foreground">
          Cargando PDF…
        </div>
      ) : null}
      {state.phase === 'error' ? (
        <div className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-3 p-6 text-center text-sm">
          <p className="text-destructive">{state.message}</p>
          {srcUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={srcUrl} target="_blank" rel="noopener noreferrer">
                Abrir en nueva pestaña
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
      {state.phase === 'ready' ? (
        <iframe
          title={title}
          src={`${state.blobUrl}#view=FitH`}
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />
      ) : null}
    </div>
  );
}
