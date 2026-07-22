'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from '@/lib/compras/orden/swal';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { CompraOrdenDraftWorkspace } from '@/components/compras/CompraOrdenDraftWorkspace';
import { CompraOrdenGeneratedDetail } from '@/components/compras/CompraOrdenGeneratedDetail';
import { CompraStatusBadge } from '@/components/compras/CompraStatusBadge';
import { useCompraOrden, useCompraOrdenes } from '@/hooks/useCompraOrden';
import { useProveedores } from '@/hooks/useCompras';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import { ORDER_STATUS_LABELS } from '@/lib/compras/orden/constants';
import type { CreatePurchaseOrderInput, DraftPurchaseOrderInput } from '@/lib/compras/orden/schemas';
import type { OrdenWorkflowActionName } from '@/hooks/useCompraOrden';
import type { PurchaseOrderStatus } from '@prisma/client';
import {
  getPurchaseOrderApiErrorMessage,
  getPurchaseOrderValidationDetails,
} from '@/lib/api-error';

const ACTION_LABELS: Record<OrdenWorkflowActionName, string> = {
  validar: 'Orden generada',
  generar: 'Orden generada',
  emitir: 'Orden emitida',
  regenerar_pdf: 'PDF regenerado',
  anular: 'Orden anulada',
  cerrar: 'Orden cerrada',
};

const VALIDATION_FIELD_TO_FORM_NAME: Record<string, string> = {
  fecha: 'requestDate',
  fechaRequerida: 'requiredDate',
  solicitadoPor: 'requestedByName',
  cargoSolicitante: 'requesterJobTitle',
  proveedorNombre: 'supplierName',
  proveedorRtn: 'supplierRtn',
  proveedorTelefono: 'supplierPhone',
  justificacion: 'purchaseJustification',
  descripcion: 'description',
  unidad: 'unit',
  cantidad: 'quantity',
  precioUnitario: 'unitPrice',
};

function toFormFieldName(field: string): string | undefined {
  if (field === 'numero') return undefined;
  const itemMatch = /^items\.(\d+)\.(.+)$/.exec(field);
  if (itemMatch) {
    const property = VALIDATION_FIELD_TO_FORM_NAME[itemMatch[2]];
    return property ? `items.${itemMatch[1]}.${property}` : undefined;
  }
  return VALIDATION_FIELD_TO_FORM_NAME[field];
}

function buildValidationList(messages: string[]): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'space-y-1 text-left';
  for (const message of messages) {
    const item = document.createElement('li');
    item.textContent = `• ${message}`;
    list.appendChild(item);
  }
  return list;
}

export default function CompraDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const { data: orden, isLoading, refetch } = useCompraOrden(id);
  const { data: proveedores = [] } = useProveedores();
  const { updateOrden, runWorkflow, uploadDocumento, deleteDocumento, deleteOrden, isSaving } = useCompraOrdenes();

  if (!user) return null;
  if (isLoading || !orden) {
    return (
      <MainLayout>
        <div className="p-8">Cargando…</div>
      </MainLayout>
    );
  }

  const role = user.role as Role;
  const isCreator = orden.createdById === user.id;
  const status = (orden.status ?? orden.estado) as PurchaseOrderStatus;
  const isDraft = status === 'DRAFT';
  const orderNumber = orden.orderNumber ?? orden.numeroOrden;
  const requestedBy = orden.requestedByName ?? orden.solicitadoPorNombre;

  const handleSave = async (data: DraftPurchaseOrderInput) => {
    try {
      await updateOrden({ id, data });
      await Swal.fire({ icon: 'success', title: 'Borrador actualizado', text: 'Los cambios se guardaron correctamente.', confirmButtonText: 'Aceptar' });
      await refetch();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error(error);
      await Swal.fire({ icon: 'error', title: 'No se pudo guardar el borrador', text: getPurchaseOrderApiErrorMessage(error, 'Ocurrió un error inesperado.'), confirmButtonText: 'Cerrar' });
    }
  };

  const handleGenerateOrder = async (data: CreatePurchaseOrderInput) => {
    setGenerating(true);
    Swal.fire({ title: 'Generando orden...', text: 'Espere mientras se valida la orden y se genera el documento.', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => Swal.showLoading() });
    try {
      await updateOrden({ id, data });
       const generated = await runWorkflow({ id, action: 'validar' });
       Swal.close();
       await Swal.fire({ icon: 'success', title: 'Orden generada', text: `La orden ${generated.orderNumber} fue generada correctamente.`, confirmButtonText: 'Aceptar' });
      await refetch();
    } catch (error) {
      Swal.close();
      const details = getPurchaseOrderValidationDetails(error);
      if (details) {
        await Swal.fire({
          icon: 'warning',
          title: 'Revise la orden',
          html: buildValidationList(details.map((detail) => detail.message)),
          confirmButtonText: 'Revisar',
        });
        const fieldName = toFormFieldName(details[0].field);
        const control = fieldName ? document.getElementsByName(fieldName)[0] : undefined;
        control?.focus();
        control?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        await Swal.fire({ icon: 'error', title: 'No se pudo generar la orden', text: getPurchaseOrderApiErrorMessage(error, 'Ocurrió un error inesperado.'), confirmButtonText: 'Cerrar' });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleWorkflow = async (action: OrdenWorkflowActionName, motivoAnulacion?: string) => {
    try {
      if (action === 'anular') {
        await runWorkflow({ id, action, motivoAnulacion });
      } else {
        await runWorkflow({ id, action });
      }
      await Swal.fire({ icon: 'success', title: ACTION_LABELS[action], confirmButtonText: 'Aceptar' });
      await refetch();
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Acción no completada', text: getPurchaseOrderApiErrorMessage(error, 'Ocurrió un error inesperado.'), confirmButtonText: 'Cerrar' });
      throw error;
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    const confirmation = await Swal.fire({ icon: 'warning', title: '¿Eliminar adjunto?', text: 'Esta acción no se puede deshacer.', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', reverseButtons: true, focusCancel: true });
    if (!confirmation.isConfirmed) return;
    try {
      await deleteDocumento({ orderId: id, documentId });
      await Swal.fire({ icon: 'success', title: 'Documento eliminado', confirmButtonText: 'Aceptar' });
      await refetch();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error(error);
      await Swal.fire({ icon: 'error', title: 'No se pudo eliminar el documento', text: getPurchaseOrderApiErrorMessage(error, 'Ocurrió un error inesperado.'), confirmButtonText: 'Cerrar' });
    }
  };

  const handleUploadDocument = async (file: File, type: string) => {
    try {
      await uploadDocumento({ id, file, tipo: type });
      await Swal.fire({ icon: 'success', title: 'Documento subido', text: `${file.name} se subió correctamente.`, confirmButtonText: 'Aceptar' });
      await refetch();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error(error);
      await Swal.fire({ icon: 'error', title: 'No se pudo subir el documento', text: getPurchaseOrderApiErrorMessage(error, 'Ocurrió un error inesperado.'), confirmButtonText: 'Cerrar' });
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteOrden(id);
      await Swal.fire({ icon: 'success', title: 'Borrador eliminado', confirmButtonText: 'Aceptar' });
      router.push('/compras/solicitudes');
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar',
        text: getPurchaseOrderApiErrorMessage(error, 'Ocurrió un error inesperado.'),
        confirmButtonText: 'Cerrar',
      });
    }
  };

  return (
    <MainLayout>
      <div className="font-[Aptos,'Segoe_UI',sans-serif]">
      <PageHeader
        title="Orden de Compra"
        description={`${orderNumber ?? 'Borrador'} · ${requestedBy}`}
      >
        <CompraStatusBadge estado={status as never} label={ORDER_STATUS_LABELS[status]} />
      </PageHeader>

      {isDraft ? (
        <CompraOrdenDraftWorkspace
          proveedores={proveedores}
          defaultValues={orden}
          orderId={id}
          documents={orden.documentos ?? []}
          pendingDocuments={[]}
          onPendingChange={() => undefined}
          onSave={handleSave}
          onGenerateOrder={
            canOrdenAction(role, 'generar', { isCreator, status })
              ? handleGenerateOrder
              : undefined
          }
          onUpload={
            canOrdenAction(role, 'documentos', { isCreator, status })
              ? handleUploadDocument
              : undefined
          }
          onDeleteDocument={handleDeleteDocument}
          canUploadDocuments={canOrdenAction(role, 'documentos', { isCreator, status })}
          canDeleteDocuments={canOrdenAction(role, 'documentos', { isCreator, status })}
          isSaving={isSaving}
          isGenerating={generating}
          onDelete={canOrdenAction(role, 'delete', { isCreator, status }) ? handleDelete : undefined}
          canDelete={canOrdenAction(role, 'delete', { isCreator, status })}
        />
      ) : (
        <CompraOrdenGeneratedDetail
          orden={orden}
          role={role}
          userId={user.id}
          onWorkflow={handleWorkflow}
          onDeleteDocument={handleDeleteDocument}
          onUpload={
            canOrdenAction(role, 'documentos', { isCreator, status })
              ? handleUploadDocument
              : undefined
          }
          isSaving={isSaving}
        />
      )}
      </div>
    </MainLayout>
  );
}
