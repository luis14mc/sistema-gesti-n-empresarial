'use client';

import { sileo } from 'sileo';

const CLEANUP_TIMEOUT_MS = 120_000;

export type PrintPdfDeps = {
  fetch: typeof fetch;
  document: Document;
  window: Window;
};

export function createPrintPdfDeps(): PrintPdfDeps {
  return {
    fetch: globalThis.fetch.bind(globalThis),
    document: globalThis.document,
    window: globalThis.window,
  };
}

export function isPdfContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return normalized === 'application/pdf';
}

/**
 * Loads a same-origin PDF (session cookies) and returns a blob URL for embedding in iframe/object.
 * Caller must revoke the URL when done.
 */
export async function fetchPdfBlobUrl(
  url: string,
  init?: RequestInit & { signal?: AbortSignal },
  fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<string> {
  const response = await fetchFn(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
  if (!response.ok) {
    throw new Error(`PDF_FETCH_FAILED:${response.status}`);
  }
  const contentType = response.headers.get('Content-Type');
  if (!isPdfContentType(contentType)) {
    throw new Error('PDF_FETCH_NOT_PDF');
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function cleanupPrintFrame(iframe: HTMLIFrameElement, blobUrl: string): void {
  try {
    URL.revokeObjectURL(blobUrl);
  } catch {
    /* ignore */
  }
  iframe.remove();
}

function scheduleCleanup(
  iframe: HTMLIFrameElement,
  blobUrl: string,
  deps: PrintPdfDeps,
  contentWindow: Window | null,
): void {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cleanupPrintFrame(iframe, blobUrl);
  };

  if (contentWindow) {
    contentWindow.addEventListener('afterprint', finish, { once: true });
  }
  deps.window.setTimeout(finish, CLEANUP_TIMEOUT_MS);
}

export function openPdfFallback(blobUrl: string, deps: PrintPdfDeps): void {
  const opened = deps.window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (opened) {
    deps.window.setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        /* ignore */
      }
    }, CLEANUP_TIMEOUT_MS);
    return;
  }

  sileo.warning({
    title: 'No se pudo abrir el visor de PDF',
    description: (
      <span>
        El navegador bloqueó la ventana emergente.{' '}
        <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
          Abrir PDF
        </a>
      </span>
    ),
  });
}

/**
 * Fetches the official PDF at `url` (same origin, cookies) and triggers the browser print dialog.
 * Falls back to a new tab when iframe printing is blocked.
 */
export async function printPdf(url: string, deps: PrintPdfDeps = createPrintPdfDeps()): Promise<void> {
  const response = await deps.fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`PRINT_PDF_FETCH_FAILED:${response.status}`);
  }
  const contentType = response.headers.get('Content-Type');
  if (!isPdfContentType(contentType)) {
    throw new Error('PRINT_PDF_NOT_PDF');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const iframe = deps.document.createElement('iframe');
  iframe.setAttribute('title', 'Impresión PDF');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  deps.document.body.appendChild(iframe);

  await new Promise<void>((resolve, reject) => {
    const onError = () => {
      cleanupPrintFrame(iframe, blobUrl);
      reject(new Error('PRINT_PDF_IFRAME_LOAD_FAILED'));
    };

    iframe.addEventListener('error', onError, { once: true });

    iframe.addEventListener(
      'load',
      () => {
        iframe.removeEventListener('error', onError);
        const contentWindow = iframe.contentWindow;
        try {
          contentWindow?.focus();
          contentWindow?.print();
          scheduleCleanup(iframe, blobUrl, deps, contentWindow);
          resolve();
        } catch {
          iframe.remove();
          openPdfFallback(blobUrl, deps);
          resolve();
        }
      },
      { once: true },
    );

    iframe.src = blobUrl;
  });
}
