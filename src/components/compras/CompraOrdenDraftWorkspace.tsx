'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Trash2, Upload } from 'lucide-react';
import Swal from '@/lib/compras/orden/swal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompraOrdenForm, type CompraOrdenFormHandle } from './CompraOrdenForm';
import { PurchaseOrderPreview } from './PurchaseOrderPreview';
import { PurchaseOrderAttachmentRows } from './PurchaseOrderAttachmentRows';
import { RELATED_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/compras/orden/constants';
import { validatePurchaseDocumentFile } from '@/lib/compras/orden/document-validation';
import type { CreatePurchaseOrderInput, DraftPurchaseOrderInput } from '@/lib/compras/orden/schemas';
import type { CompraOrden } from '@/types/compra-orden';
import type { PendingPurchaseDocument } from '@/types/compra-orden-documents';
import type { Proveedor } from '@/types/compras';
import type { PurchaseDocumentType } from '@prisma/client';

const FORM_ID = 'compra-orden-draft-form';

function createPendingDocument(file: File, documentType: PurchaseDocumentType): PendingPurchaseDocument {
  return {
    id: crypto.randomUUID(),
    file,
    documentType,
    previewUrl: URL.createObjectURL(file),
    status: 'PENDING',
  };
}

interface CompraOrdenDraftWorkspaceProps {
  proveedores: Proveedor[];
  defaultValues?: Partial<CompraOrden>;
  orderId?: string;
  documents?: CompraOrden['documentos'];
  pendingDocuments: PendingPurchaseDocument[];
  onPendingChange: (documents: PendingPurchaseDocument[]) => void;
  onSave: (data: DraftPurchaseOrderInput) => Promise<void>;
  onGenerateOrder?: (data: CreatePurchaseOrderInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  canDelete?: boolean;
  onUpload?: (file: File, type: string) => Promise<void>;
  onDeleteDocument?: (documentId: string) => Promise<void>;
  canUploadDocuments?: boolean;
  canDeleteDocuments?: boolean;
  isSaving?: boolean;
  isGenerating?: boolean;
  backHref?: string;
}

export function CompraOrdenDraftWorkspace({
  proveedores,
  defaultValues,
  orderId,
  documents = [],
  pendingDocuments,
  onPendingChange,
  onSave,
  onGenerateOrder,
  onDelete,
  canDelete,
  onUpload,
  onDeleteDocument,
  canUploadDocuments,
  canDeleteDocuments,
  isSaving,
  isGenerating,
  backHref = '/compras/solicitudes',
}: CompraOrdenDraftWorkspaceProps) {
  const [previewValues, setPreviewValues] = useState<DraftPurchaseOrderInput | null>(null);
  const formRef = useRef<CompraOrdenFormHandle>(null);
  const [documentType, setDocumentType] = useState<PurchaseDocumentType>('QUOTATION');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pendingDocuments);

  useEffect(() => {
    pendingRef.current = pendingDocuments;
  }, [pendingDocuments]);

  useEffect(() => () => {
    for (const document of pendingRef.current) {
      if (document.previewUrl) URL.revokeObjectURL(document.previewUrl);
    }
  }, []);

  const addPendingFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const next = [...pendingDocuments];
      for (const file of Array.from(files)) {
        const error = validatePurchaseDocumentFile(file, next);
        if (error) {
          void Swal.fire({ icon: 'warning', title: file.name, text: error, confirmButtonText: 'Aceptar' });
          continue;
        }
        next.push(createPendingDocument(file, documentType));
      }
      onPendingChange(next);
    },
    [documentType, onPendingChange, pendingDocuments]
  );

  const removePending = (id: string) => {
    const target = pendingDocuments.find((doc) => doc.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onPendingChange(pendingDocuments.filter((doc) => doc.id !== id));
  };

  const handleStoredUpload = async (files: FileList | null) => {
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

  const handleGenerateClick = async () => {
    if (!onGenerateOrder) return;
    const data = await formRef.current?.validateForGeneration();
    if (!data) return;
    const result = await Swal.fire({
      icon: 'question',
      title: 'Validar y generar orden',
      text: 'Se validará la información y se generará el documento final con el correlativo existente.',
      showCancelButton: true,
      confirmButtonText: 'Validar y generar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!result.isConfirmed) return;
    await onGenerateOrder(data);
  };

  const handleDeleteClick = async () => {
    if (!onDelete) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar borrador?',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!result.isConfirmed) return;
    await onDelete();
  };

  return (
    <div className="space-y-6 font-[Aptos,'Segoe_UI',sans-serif]">
      <CompraOrdenForm
        ref={formRef}
        formId={FORM_ID}
        hideActions
        proveedores={proveedores}
        defaultValues={defaultValues}
        onSubmit={onSave}
        onValuesChange={setPreviewValues}
        isSubmitting={isSaving}
      />

      <Card id="documentos">
        <CardHeader><CardTitle>Documentos adjuntos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(canUploadDocuments || !orderId) && (
            <div
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                if (orderId && onUpload) void handleStoredUpload(event.dataTransfer.files);
                else addPendingFiles(event.dataTransfer.files);
              }}
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Arrastre archivos aquí o haga clic para subir</p>
              <p className="mt-1 text-sm text-muted-foreground">PDF, JPG, JPEG o PNG · Máximo 10 MB</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <select value={documentType} onChange={(event) => setDocumentType(event.target.value as PurchaseDocumentType)} className="rounded-md border px-3 py-2 text-sm">
                  {RELATED_DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}
                </select>
                <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => {
                  if (orderId && onUpload) void handleStoredUpload(event.target.files);
                  else addPendingFiles(event.target.files);
                }} />
                <Button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? 'Subiendo…' : 'Subir documentos'}</Button>
              </div>
            </div>
          )}
          <PurchaseOrderAttachmentRows orderId={orderId} pendingDocuments={orderId ? [] : pendingDocuments} storedDocuments={documents} canDelete={canDeleteDocuments} onRemovePending={orderId ? undefined : removePending} onDeleteStored={onDeleteDocument} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vista previa de la orden de compra</CardTitle></CardHeader>
        <CardContent>
          <PurchaseOrderPreview order={previewValues} savedOrder={orderId ? defaultValues as CompraOrden : undefined} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
        <Link href={backHref} className="mr-auto text-sm text-muted-foreground hover:text-foreground">Volver</Link>
        {canDelete && onDelete ? (
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={isSaving || isGenerating} onClick={() => void handleDeleteClick()}>
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar borrador
          </Button>
        ) : null}
        <Button variant="outline" type="submit" form={FORM_ID} disabled={isSaving || isGenerating}>{isSaving ? 'Guardando...' : orderId ? 'Guardar cambios' : 'Guardar orden'}</Button>
        {onGenerateOrder && orderId ? <Button type="button" disabled={isSaving || isGenerating} onClick={() => void handleGenerateClick()}>{isGenerating ? 'Validando y generando...' : 'Validar y generar orden'}</Button> : null}
      </div>
    </div>
  );
}

export async function uploadPendingPurchaseDocuments(
  orderId: string,
  documents: PendingPurchaseDocument[],
  uploadFn: (orderId: string, file: File, tipo: string) => Promise<unknown>
) {
  let uploaded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const doc of documents) {
    if (doc.status === 'UPLOADED') {
      uploaded += 1;
      continue;
    }
    try {
      await uploadFn(orderId, doc.file, doc.documentType);
      uploaded += 1;
    } catch (error) {
      failed += 1;
      errors.push(
        `${doc.file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
    }
  }

  return { uploaded, failed, errors };
}
