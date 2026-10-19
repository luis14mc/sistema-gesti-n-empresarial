'use client';

import { useRef, useState } from 'react';
import { Download, ExternalLink, Maximize2, MoreHorizontal } from 'lucide-react';
import { PrintPurchaseOrderPdfButton } from '@/components/compras/PrintPurchaseOrderPdfButton';
import { PurchaseOrderPdfViewer } from '@/components/compras/PurchaseOrderPdfViewer';
import Swal from '@/lib/compras/orden/swal';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PurchaseOrderPreview } from './PurchaseOrderPreview';
import { PurchaseOrderAttachmentRows } from './PurchaseOrderAttachmentRows';
import { CompraOrdenHistory } from './CompraOrdenHistory';
import { RELATED_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/compras/orden/constants';
import { validatePurchaseDocumentFile } from '@/lib/compras/orden/document-validation';
import type { PurchaseDocumentType } from '@prisma/client';
import { compraOrdenService } from '@/services/compra-orden.service';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { CompraOrden } from '@/types/compra-orden';
import type { Role } from '@/types';
import type { PurchaseOrderStatus } from '@prisma/client';
import type { OrdenWorkflowActionName } from '@/hooks/useCompraOrden';

const ACTION_LABELS: Record<OrdenWorkflowActionName, string> = {
  validar: 'Validar y generar orden',
  generar: 'Generar orden',
  emitir: 'Emitir',
  regenerar_pdf: 'Regenerar PDF',
  anular: 'Anular',
  cerrar: 'Cerrar',
};

interface CompraOrdenGeneratedDetailProps {
  orden: CompraOrden;
  role: Role;
  userId: string;
  onWorkflow: (action: OrdenWorkflowActionName, motivoAnulacion?: string) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onUpload?: (file: File, type: string) => Promise<void>;
  isSaving?: boolean;
}

export function CompraOrdenGeneratedDetail({
  orden,
  role,
  userId,
  onWorkflow,
  onDeleteDocument,
  onUpload,
  isSaving,
}: CompraOrdenGeneratedDetailProps) {
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [showAnular, setShowAnular] = useState(false);
  const [working, setWorking] = useState(false);
  const [documentType, setDocumentType] = useState<PurchaseDocumentType>('QUOTATION');
  const [uploading, setUploading] = useState(false);
  const [fullscreenPdf, setFullscreenPdf] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCreator = orden.createdById === userId;
  const status = (orden.status ?? orden.estado) as PurchaseOrderStatus;
  const documents = orden.documentos ?? [];
  const activePdf = documents.find((document) => document.type === 'ORDER_PDF' && document.isActive);
  const canViewPdf = canOrdenAction(role, 'read', { isCreator, status });
  const pdfViewUrl =
    activePdf && canViewPdf ? compraOrdenService.getDocumentViewUrl(orden.id, activePdf.id) : null;
  const pdfDownloadUrl =
    activePdf && canViewPdf ? compraOrdenService.getDocumentDownloadUrl(orden.id, activePdf.id) : null;

  const canEmitir = canOrdenAction(role, 'emitir', { isCreator, status });
  const canCerrar = canOrdenAction(role, 'cerrar', { isCreator, status });
  const canAnular = canOrdenAction(role, 'anular', { isCreator, status });
  const canRegenerar = canOrdenAction(role, 'regenerar_pdf', { isCreator, status });
  const canManageDocuments = canOrdenAction(role, 'documentos', { isCreator, status });

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !onUpload) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const error = validatePurchaseDocumentFile(file);
        if (error) {
          await Swal.fire({ icon: 'warning', title: file.name, text: error, confirmButtonText: 'Aceptar' });
          continue;
        }
        await onUpload(file, documentType);
      }
      if (inputRef.current) inputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  };

  const runAction = async (action: OrdenWorkflowActionName) => {
    if (action === 'anular') {
      if (!motivoAnulacion.trim()) {
        await Swal.fire({ icon: 'warning', title: 'Motivo requerido', confirmButtonText: 'Aceptar' });
        return;
      }
      setWorking(true);
      try {
        await onWorkflow(action, motivoAnulacion);
        setShowAnular(false);
      } finally {
        setWorking(false);
      }
      return;
    }
    setWorking(true);
    try {
      await onWorkflow(action);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-1 border-b bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="mr-auto sm:mr-0">
            <Link href="/compras/ordenes">← Volver a órdenes</Link>
          </Button>
          {canViewPdf && pdfDownloadUrl ? (
            <Button asChild variant="default" data-testid="download-purchase-order-pdf">
              <a href={pdfDownloadUrl} download>
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
          ) : null}
          {canViewPdf && activePdf ? (
            <PrintPurchaseOrderPdfButton orderId={orden.id} documentId={activePdf.id} />
          ) : null}
          {canViewPdf && pdfViewUrl ? (
            <Button asChild variant="outline">
              <a href={pdfViewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver PDF
              </a>
            </Button>
          ) : null}
          {canEmitir ? (
            <Button disabled={working || isSaving} onClick={() => void runAction('emitir')}>
              {ACTION_LABELS.emitir}
            </Button>
          ) : null}
          {canCerrar ? (
            <Button variant="secondary" disabled={working || isSaving} onClick={() => void runAction('cerrar')}>
              {ACTION_LABELS.cerrar}
            </Button>
          ) : null}
          {canAnular ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowAnular(true)}
                >
                  Anular orden…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>PDF oficial</CardTitle>
          {pdfViewUrl ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setFullscreenPdf(true)}>
              <Maximize2 className="mr-2 h-4 w-4" />
              Pantalla completa
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {pdfViewUrl ? (
            <PurchaseOrderPdfViewer srcUrl={pdfViewUrl} title="PDF de la orden de compra" />
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              <p className="mb-4">No hay un PDF activo para esta orden.</p>
              {canRegenerar ? (
                <Button
                  type="button"
                  disabled={working || isSaving}
                  onClick={() => void runAction('regenerar_pdf')}
                >
                  Regenerar PDF
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la orden</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseOrderPreview savedOrder={orden} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="documentos">
          <CardHeader>
            <CardTitle>Documentos adjuntos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManageDocuments && onUpload ? (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <select
                    className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as PurchaseDocumentType)}
                  >
                    {RELATED_DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DOCUMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  ref={inputRef}
                  type="file"
                  multiple
                  disabled={uploading}
                  onChange={(e) => void handleUpload(e.target.files)}
                />
              </div>
            ) : null}
            <PurchaseOrderAttachmentRows
              orderId={orden.id}
              storedDocuments={documents}
              canDelete={canManageDocuments}
              onDeleteStored={(documentId) => void onDeleteDocument(documentId)}
            />
          </CardContent>
        </Card>
        <CompraOrdenHistory ordenId={orden.id} />
      </div>

      <Dialog open={showAnular} onOpenChange={setShowAnular}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular orden</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Indique el motivo de anulación (mínimo 5 caracteres).</p>
          <Input
            value={motivoAnulacion}
            onChange={(e) => setMotivoAnulacion(e.target.value)}
            placeholder="Motivo…"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAnular(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={working || isSaving}
              onClick={() => void runAction('anular')}
            >
              Anular
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fullscreenPdf} onOpenChange={setFullscreenPdf}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-[95vw] max-w-6xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>PDF — pantalla completa</DialogTitle>
          </DialogHeader>
          {pdfViewUrl ? (
            <div className="min-h-0 flex-1">
              <PurchaseOrderPdfViewer
                srcUrl={pdfViewUrl}
                title="PDF pantalla completa"
                minHeightClass="min-h-full h-full"
                className="h-full"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
