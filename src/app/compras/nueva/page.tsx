'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from '@/lib/compras/orden/swal';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  CompraOrdenDraftWorkspace,
  uploadPendingPurchaseDocuments,
} from '@/components/compras/CompraOrdenDraftWorkspace';
import { useCompraOrdenes } from '@/hooks/useCompraOrden';
import { useProveedores } from '@/hooks/useCompras';
import { useAuth } from '@/hooks/useAuth';
import type { CreatePurchaseOrderInput, DraftPurchaseOrderInput } from '@/lib/compras/orden/schemas';
import type { PendingPurchaseDocument } from '@/types/compra-orden-documents';
import { getPurchaseOrderApiErrorMessage } from '@/lib/api-error';

export default function NuevaCompraPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: proveedores = [] } = useProveedores();
  const { createOrden, uploadDocumento, isSaving } = useCompraOrdenes();
  const [pendingDocuments, setPendingDocuments] = useState<PendingPurchaseDocument[]>([]);

  if (!user) return null;

  const handleSave = async (data: DraftPurchaseOrderInput) => {
    try {
    const orden = await createOrden(data);
    const docsToUpload = pendingDocuments.filter((doc) => doc.status !== 'UPLOADED');

    if (docsToUpload.length === 0) {
      await Swal.fire({ icon: 'success', title: 'Borrador guardado', text: 'La orden se guardó correctamente.', confirmButtonText: 'Aceptar' });
      router.push(`/compras/ordenes/${orden.id}`);
      return;
    }

    const { uploaded, failed, errors } = await uploadPendingPurchaseDocuments(
      orden.id,
      docsToUpload,
      async (orderId, file, tipo) => {
        await uploadDocumento({ id: orderId, file, tipo });
      }
    );

    if (failed === 0) {
      await Swal.fire({ icon: 'success', title: 'Borrador guardado', text: `${uploaded} documento${uploaded === 1 ? '' : 's'} subido${uploaded === 1 ? '' : 's'}.`, confirmButtonText: 'Aceptar' });
    } else {
      await Swal.fire({ icon: 'warning', title: 'Borrador guardado con advertencias', text: `${uploaded} documento${uploaded === 1 ? '' : 's'} subido${uploaded === 1 ? '' : 's'}. ${failed} no se pudo${failed === 1 ? '' : 'ieron'} subir.`, confirmButtonText: 'Aceptar' });
      if (errors.length) {
        await Swal.fire({ icon: 'error', title: 'Errores de carga', text: errors.join(' · '), confirmButtonText: 'Cerrar' });
      }
    }

    router.push(`/compras/ordenes/${orden.id}`);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error(error);
      await Swal.fire({ icon: 'error', title: 'No se pudo guardar el borrador', text: getPurchaseOrderApiErrorMessage(error, 'Ocurrió un error inesperado.'), confirmButtonText: 'Cerrar' });
    }
  };

  return (
    <MainLayout>
      <div className="font-[Aptos,'Segoe_UI',sans-serif]">
      <PageHeader title="Nueva Orden de Compra" description="Complete la ficha institucional CNI" />
      <CompraOrdenDraftWorkspace
        proveedores={proveedores}
        pendingDocuments={pendingDocuments}
        onPendingChange={setPendingDocuments}
        onSave={handleSave}
        isSaving={isSaving}
        backHref="/compras/solicitudes"
      />
      </div>
    </MainLayout>
  );
}
