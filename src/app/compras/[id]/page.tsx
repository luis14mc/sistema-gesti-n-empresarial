'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from '@/components/compras/purchase-order-swal';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { CompraOrdenDraftWorkspace } from '@/components/compras/CompraOrdenDraftWorkspace';
import { CompraOrdenGeneratedDetail } from '@/components/compras/CompraOrdenGeneratedDetail';
import { CompraStatusBadge } from '@/components/compras/CompraStatusBadge';
import { useCompraOrden, useCompraOrdenes } from '@/hooks/useCompraOrden';
import { useProveedores } from '@/hooks/useCompras';
import { useAuth } from '@/hooks/useAuth';
import {
  canCompraOrdenAction,
  useOrganizationPermissions,
} from '@/modules/purchases/presentation/purchase-order-client-permissions';
import { CompraOrdenLoadError } from '@/components/compras/CompraOrdenLoadError';
import { ORDER_STATUS_LABELS } from '@/modules/purchases/domain/purchase-order-constants';
import type { CreatePurchaseOrderInput, DraftPurchaseOrderInput } from '@/modules/purchases/presentation/purchase-order-schemas';
import type { OrdenWorkflowActionName } from '@/hooks/useCompraOrden';
import type { PurchaseOrderStatus } from '@prisma/client';
import {
  getPurchaseOrderApiErrorMessage,
  getPurchaseOrderValidationDetails,
} from '@/platform/api/api-error';
import { draftProvisionalLabel } from '@/components/compras/purchase-order-format-list';

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
  const permissions = useOrganizationPermissions();
  const { data: orden, isLoading, isError, error, refetch } = useCompraOrden(id);
  const { data: proveedoresData } = useProveedores({ pageSize: 100 });
  const proveedores = proveedoresData?.proveedores ?? [];
  const { updateOrden, runWorkflow, uploadDocumento, deleteDocumento, deleteOrden, isSaving } = useCompraOrdenes();

  if (!user) return null;
  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-8">Cargando…</div>
      </MainLayout>
    );
  }
  if (isError) {
    return (
      <MainLayout>
        <CompraOrdenLoadError error={error} />
      </MainLayout>
    );
  }
  if (!orden) {
    return (
      <MainLayout>
        <CompraOrdenLoadError error={{ response: { status: 404, data: { error: 'Orden no encontrada' } } }} />
      </MainLayout>
    );
  }

  const isCreator = orden.createdById === user.id;
  const status = (orden.status ?? orden.estado) as PurchaseOrderStatus;
  const membershipRole = (user.membershipRole ?? user.role) as
    | import('@/platform/security/authorization/permissions').OrganizationRole
    | undefined;
  const actionCtx = { isCreator, status, membershipRole, sessionRole: user.role };
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
       await Swal.fire({
         icon: 'success',
         title: 'Orden generada',
         text: `La orden ${generated.orderNumber} fue generada correctamente.`,
         confirmButtonText: 'Aceptar',
       });
       router.push(`/compras/ordenes/${id}`);
       return;
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
      router.push('/compras/borradores');
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
        title={isDraft ? 'Borrador de orden de compra' : `Orden ${orderNumber ?? ''}`.trim()}
        description={isDraft ? `${draftProvisionalLabel(orden)} · ${requestedBy}` : `${requestedBy} · ${orden.supplierName ?? orden.proveedorNombre ?? ''}`}
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
            canCompraOrdenAction(permissions, 'generar', actionCtx)
              ? handleGenerateOrder
              : undefined
          }
          onUpload={
            canCompraOrdenAction(permissions, 'documentos', actionCtx)
              ? handleUploadDocument
              : undefined
          }
          onDeleteDocument={handleDeleteDocument}
          canUploadDocuments={canCompraOrdenAction(permissions, 'documentos', actionCtx)}
          canDeleteDocuments={canCompraOrdenAction(permissions, 'documentos', actionCtx)}
          isSaving={isSaving}
          isGenerating={generating}
          onDelete={canCompraOrdenAction(permissions, 'delete', actionCtx) ? handleDelete : undefined}
          canDelete={canCompraOrdenAction(permissions, 'delete', actionCtx)}
        />
      ) : (
        <CompraOrdenGeneratedDetail
          orden={orden}
          permissions={permissions}
          membershipRole={membershipRole}
          sessionRole={user.role}
          userId={user.id}
          onWorkflow={handleWorkflow}
          onDeleteDocument={handleDeleteDocument}
          onUpload={
            canCompraOrdenAction(permissions, 'documentos', actionCtx)
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
