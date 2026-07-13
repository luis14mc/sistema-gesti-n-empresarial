'use client';

import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { CompraForm } from '@/components/compras/CompraForm';
import { useCentrosCosto, useComprasSolicitudes, useProveedores } from '@/hooks/useCompras';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/hooks/useAuth';
import type { BorradorCompraSolicitudInput } from '@/lib/compras/schemas';

export default function NuevaCompraPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { departments } = useDepartments();
  const { data: centros = [] } = useCentrosCosto();
  const { data: proveedores = [] } = useProveedores();
  const { createSolicitud, isSaving } = useComprasSolicitudes();

  if (!user) return null;

  const handleSubmit = async (data: BorradorCompraSolicitudInput) => {
    try {
      const solicitud = await createSolicitud(data);
      sileo.success({
        title: 'Solicitud creada',
        description: solicitud.numero,
      });
      router.push(`/compras/${solicitud.id}`);
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
        title="Nueva Solicitud y Orden de Compra"
        description="Complete la ficha institucional y guarde como borrador"
      />
      <CompraForm
        departments={departments}
        centros={centros}
        proveedores={proveedores}
        solicitante={{
          nombre: `${user.firstName} ${user.lastName}`,
          cargo: user.position?.name,
          departmentId: user.departmentId ?? undefined,
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
      />
    </MainLayout>
  );
}
