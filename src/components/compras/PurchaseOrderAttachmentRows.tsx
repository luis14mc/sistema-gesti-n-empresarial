'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DOCUMENT_TYPE_LABELS } from '@/lib/compras/orden/constants';
import { PurchaseDocumentViewerDialog } from './PurchaseDocumentViewerDialog';
import {
  buildDocumentDownloadUrl,
  type PendingPurchaseDocument,
  type ViewerDocument,
} from '@/types/compra-orden-documents';
import type { CompraOrdenDocumento } from '@/types/compra-orden';
import type { PurchaseDocumentType } from '@prisma/client';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeLabel(mimeType: string) {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return mimeType.replace('image/', '').toUpperCase();
  return mimeType;
}

interface PurchaseOrderAttachmentRowsProps {
  orderId?: string;
  pendingDocuments?: PendingPurchaseDocument[];
  storedDocuments?: CompraOrdenDocumento[];
  canDelete?: boolean;
  onRemovePending?: (id: string) => void;
  onDeleteStored?: (documentId: string) => void;
}

export function PurchaseOrderAttachmentRows({
  orderId,
  pendingDocuments = [],
  storedDocuments = [],
  canDelete,
  onRemovePending,
  onDeleteStored,
}: PurchaseOrderAttachmentRowsProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<ViewerDocument | null>(null);
  const relatedStored = storedDocuments.filter((doc) => doc.type !== 'ORDER_PDF');

  const openViewer = (doc: ViewerDocument) => {
    setViewerDoc(doc);
    setViewerOpen(true);
  };

  const rows = [
    ...pendingDocuments.map((doc) => ({
      key: doc.id,
      name: doc.file.name,
      mimeType: doc.file.type,
      size: doc.file.size,
      subtitle: `${mimeLabel(doc.file.type)} · ${formatSize(doc.file.size)}`,
      viewer: {
        originalName: doc.file.name,
        mimeType: doc.file.type,
        localUrl: doc.previewUrl,
      } satisfies ViewerDocument,
      onDelete: onRemovePending ? () => onRemovePending(doc.id) : undefined,
      downloadUrl: doc.previewUrl,
    })),
    ...relatedStored.map((doc) => ({
      key: doc.id,
      name: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
      subtitle: `${DOCUMENT_TYPE_LABELS[doc.type as PurchaseDocumentType] ?? mimeLabel(doc.mimeType)} · ${formatSize(doc.size)}`,
      viewer: {
        id: doc.id,
        orderId,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
      } satisfies ViewerDocument,
      onDelete: canDelete && onDeleteStored ? () => onDeleteStored(doc.id) : undefined,
      downloadUrl: orderId ? buildDocumentDownloadUrl(orderId, doc.id) : undefined,
    })),
  ];

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No hay documentos adjuntos.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-md border">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left hover:opacity-80"
                onClick={() => openViewer(row.viewer)}
              >
                <p className="truncate font-medium">{row.name}</p>
                <p className="text-sm text-muted-foreground">{row.subtitle}</p>
              </button>
              {(row.downloadUrl || row.onDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {row.downloadUrl && (
                      <DropdownMenuItem asChild>
                        <a href={row.downloadUrl} download={row.name}>
                          Descargar
                        </a>
                      </DropdownMenuItem>
                    )}
                    {row.onDelete && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={row.onDelete}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </li>
        ))}
      </ul>

      <PurchaseDocumentViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        document={viewerDoc}
      />
    </>
  );
}
