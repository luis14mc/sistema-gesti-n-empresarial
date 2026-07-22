'use client';

import { useRef, useState } from 'react';
import { Upload, MoreHorizontal, Download } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const isCreator = orden.createdById === userId;
  const status = (orden.status ?? orden.estado) as PurchaseOrderStatus;
  const documents = orden.documentos ?? [];
  const orderNumber = orden.orderNumber ?? orden.numeroOrden;
  const activePdf = documents.find((document) => document.type === 'ORDER_PDF' && document.isActive);
  const pdfDownloadUrl = activePdf ? compraOrdenService.getDocumentDownloadUrl(orden.id, activePdf.id) : null;

  const secondaryActions: Array<{ key: Exclude<OrdenWorkflowActionName, 'validar' | 'generar'>; destructive?: boolean }> = [];
  (['anular'] as const).forEach((key) => {
    if (canOrdenAction(role, key, { isCreator, status })) {
      secondaryActions.push({ key, destructive: key === 'anular' });
    }
  });

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
      <Card>
        <CardHeader>
          <CardTitle>Vista previa de la orden</CardTitle>
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
      <div className="border-t pt-6">
        <div className="flex items-center gap-3">
          <Link href="/compras/solicitudes" className="text-sm text-muted-foreground hover:text-foreground">Volver</Link>
          {secondaryActions.length ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Más acciones"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => {
            const result = await Swal.fire({ icon: 'warning', title: 'Anular orden', input: 'textarea', inputLabel: 'Motivo de anulación', inputPlaceholder: 'Escriba el motivo...', showCancelButton: true, confirmButtonText: 'Anular', cancelButtonText: 'Cancelar', reverseButtons: true, inputValidator: (value) => value.trim().length >= 5 ? undefined : 'Ingrese un motivo de al menos 5 caracteres.' });
            if (result.isConfirmed) await onWorkflow('anular', result.value);
          }}>Anular</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}
          {pdfDownloadUrl ? <Button asChild className="ml-auto"><a href={pdfDownloadUrl} download><Download className="mr-2 h-4 w-4" />Descargar PDF</a></Button> : null}
        </div>
      </div>
    </div>
  );
}
