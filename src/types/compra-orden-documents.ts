import type { PurchaseDocumentType } from '@prisma/client';

export type PendingPurchaseDocumentStatus = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'ERROR';

export type PendingPurchaseDocument = {
  id: string;
  file: File;
  documentType: PurchaseDocumentType;
  previewUrl?: string;
  status: PendingPurchaseDocumentStatus;
  error?: string;
};

/** Document opened in the viewer dialog. */
export type ViewerDocument = {
  /** Server document id — omit for local pending files. */
  id?: string;
  /** Order id — required for uploaded server documents. */
  orderId?: string;
  originalName: string;
  mimeType: string;
  /** Blob URL for local pending files only. Never pass empty string. */
  localUrl?: string;
};

export function buildDocumentViewUrl(orderId: string, documentId: string): string {
  return `/api/compras/ordenes/${orderId}/documentos/${documentId}/view`;
}

export function buildDocumentDownloadUrl(orderId: string, documentId: string): string {
  return `/api/compras/ordenes/${orderId}/documentos/${documentId}/download`;
}

export function resolveViewerUrl(document: ViewerDocument): string | null {
  if (document.localUrl) return document.localUrl;
  if (document.orderId && document.id) {
    return buildDocumentViewUrl(document.orderId, document.id);
  }
  return null;
}
