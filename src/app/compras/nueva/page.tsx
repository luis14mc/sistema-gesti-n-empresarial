'use client';

import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { CompraForm } from '@/components/compras/CompraForm';
import { useCentrosCosto, useComprasSolicitudes, useProveedores } from '@/hooks/useCompras';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/hooks/useAuth';
import type { CreateCompraSolicitudInput } from '@/lib/compras/schemas';

export default function NuevaCompraPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { departments } = useDepartments();
  const { data: centros = [] } = useCentrosCosto();
  const { data: proveedores = [] } = useProveedores();
  const { createSolicitud, isSaving } = useComprasSolicitudes();

  if (!user) return null;

  const handleSubmit = async (data: CreateCompraSolicitudInput) => {
    try {
      const result = await createSolicitud(data);
      if (result.warning) {
        sileo.warning({
          title: 'Solicitud creada sin PDF',
          description: result.warning,
        });
      } else {
        sileo.success({
          title: 'Solicitud creada',
          description: `${result.solicitud.codigoSolicitud} · PDF generado`,
        });
      }
      router.push(`/compras/${result.solicitud.id}`);
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear la solicitud',
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Nueva Solicitud de Compra"
        description="Formulario institucional — Solicitud y Orden de Compra"
      />
      <CompraForm
        departments={departments}
        centros={centros}
        proveedores={proveedores}
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
      />
    </MainLayout>
  );
}
