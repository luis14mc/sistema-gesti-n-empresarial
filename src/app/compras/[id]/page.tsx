'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { sileo } from 'sileo';
import { FileText, Printer } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { CompraForm } from '@/components/compras/CompraForm';
import { CompraStatusBadge } from '@/components/compras/CompraStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCentrosCosto,
  useCompraSolicitud,
  useComprasSolicitudes,
  useProveedores,
} from '@/hooks/useCompras';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/hooks/useAuth';
import {
  canPerformCompraAction,
  COMPRA_ACTION_LABELS,
  isCompraEditable,
} from '@/lib/compras/workflow';
import type { Role } from '@/types';
import type { BorradorCompraSolicitudInput } from '@/lib/compras/schemas';
import type { CompraWorkflowActionName } from '@/hooks/useCompras';

export default function CompraDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: solicitud, isLoading, refetch } = useCompraSolicitud(id);
  const { departments } = useDepartments();
  const { data: centros = [] } = useCentrosCosto();
  const { data: proveedores = [] } = useProveedores();
  const { updateSolicitud, runWorkflow, isSaving } = useComprasSolicitudes();
  const [motivoRechazo, setMotivoRechazo] = useState('');

  if (!user) return null;
  if (isLoading || !solicitud) {
    return <MainLayout><div className="p-8">Cargando solicitud...</div></MainLayout>;
  }

  const role = user.role as Role;
  const isOwner = solicitud.solicitadoPorId === user.id;
  const sameDepartment =
    !!user.departmentId && solicitud.departamentoSolicitanteId === user.departmentId;
  const editable = isCompraEditable(solicitud.estado) && (isOwner || role === 'ADMIN');

  const workflowActions: Array<{
    key: CompraWorkflowActionName;
    label: string;
    variant?: 'destructive';
  }> = [];

  const actionKeys: CompraWorkflowActionName[] = [
    'enviar', 'autorizar', 'aprobar', 'rechazar', 'emitir_orden', 'recibir', 'cerrar', 'anular',
  ];

  for (const key of actionKeys) {
    if (canPerformCompraAction(role, key, solicitud.estado, { isOwner, sameDepartment })) {
      workflowActions.push({
        key,
        label: COMPRA_ACTION_LABELS[key],
        variant: key === 'rechazar' || key === 'anular' ? 'destructive' : undefined,
      });
    }
  }

  const handleWorkflow = async (action: CompraWorkflowActionName) => {
    try {
      if (action === 'rechazar' && !motivoRechazo.trim()) {
        sileo.error({ title: 'Indique el motivo de rechazo' });
        return;
      }
      await runWorkflow({
        id,
        action,
        body: action === 'rechazar' ? { motivoRechazo } : undefined,
      });
      sileo.success({ title: COMPRA_ACTION_LABELS[action] });
      await refetch();
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo completar la acción',
      });
    }
  };

  const handleUpdate = async (data: BorradorCompraSolicitudInput) => {
    await updateSolicitud({ id, data });
    sileo.success({ title: 'Solicitud actualizada' });
    await refetch();
  };

  const solicitanteNombre = solicitud.solicitadoPor
    ? `${solicitud.solicitadoPor.firstName} ${solicitud.solicitadoPor.lastName}`
    : '';

  return (
    <MainLayout>
      <PageHeader
        title="Solicitud y Orden de Compra"
        description={`${solicitud.numero} · ${solicitanteNombre}`}
      >
        <CompraStatusBadge estado={solicitud.estado} />
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-6">
        {workflowActions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant ?? 'default'}
            size="sm"
            disabled={isSaving}
            onClick={() => handleWorkflow(action.key)}
          >
            {action.label}
          </Button>
        ))}
        <Button variant="outline" size="sm" asChild>
          <Link href={`/compras/${id}/imprimir`} target="_blank">
            <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
          </Link>
        </Button>
        {solicitud.documentoPdfUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={solicitud.documentoPdfUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4 mr-1" /> Descargar PDF
            </a>
          </Button>
        )}
      </div>

      {workflowActions.some((a) => a.key === 'rechazar') && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Label>Motivo de rechazo</Label>
            <Input value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} />
          </CardContent>
        </Card>
      )}

      {solicitud.motivoRechazo && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            <strong>Motivo de rechazo:</strong> {solicitud.motivoRechazo}
          </CardContent>
        </Card>
      )}

      <CompraForm
        departments={departments}
        centros={centros}
        proveedores={proveedores}
        solicitante={{
          nombre: solicitanteNombre,
          cargo: solicitud.cargoSolicitante ?? undefined,
        }}
        defaultValues={solicitud}
        onSubmit={handleUpdate}
        isSubmitting={isSaving}
        readOnly={!editable}
        showFirmas
        submitLabel="Guardar cambios"
      />
    </MainLayout>
  );
}
