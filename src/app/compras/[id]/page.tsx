'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { FileText, Send, Check, X, Printer, Download, Eye, RefreshCw } from 'lucide-react';
import { sileo } from 'sileo';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { CompraForm } from '@/components/compras/CompraForm';
import { CompraStatusBadge } from '@/components/compras/CompraStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useCentrosCosto,
  useCompraSolicitud,
  useComprasSolicitudes,
  useProveedores,
} from '@/hooks/useCompras';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/hooks/useAuth';
import { canPerformCompraAction, canRegenerateCompraDocument } from '@/lib/compras/workflow';
import { isCompraEditable } from '@/lib/compras/validation';
import { comprasService } from '@/services/compras.service';
import type { Role } from '@/types';
import type { CreateCompraSolicitudInput } from '@/lib/compras/schemas';

export default function CompraDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: solicitud, isLoading, refetch } = useCompraSolicitud(id);
  const { departments } = useDepartments();
  const { data: centros = [] } = useCentrosCosto();
  const { data: proveedores = [] } = useProveedores();
  const { updateSolicitud, runWorkflow, regenerateDocument, isSaving, isRegeneratingDocument } = useComprasSolicitudes();
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  if (!user) return null;
  if (isLoading || !solicitud) {
    return <MainLayout><div className="p-8">Cargando solicitud...</div></MainLayout>;
  }

  const role = user.role as Role;
  const isOwner = solicitud.solicitadoPorId === user.id;
  const editable = isCompraEditable(solicitud.estado) && (isOwner || role === 'ADMIN');
  const documentoActivo = solicitud.documentos?.find((doc) => doc.activo) ?? solicitud.documentos?.[0];
  const canRegenerateDoc = canRegenerateCompraDocument(solicitud.estado, role, isOwner);

  const actions = [
    { key: 'enviar' as const, label: 'Enviar', icon: Send },
    { key: 'autorizar' as const, label: 'Autorizar', icon: Check },
    { key: 'rechazar' as const, label: 'Rechazar', icon: X },
    { key: 'aprobar' as const, label: 'Aprobar', icon: Check },
    { key: 'emitirOrden' as const, label: 'Emitir orden', icon: FileText },
    { key: 'cerrar' as const, label: 'Cerrar', icon: Check },
  ].filter((a) => {
    const map = {
      enviar: 'enviar',
      autorizar: 'autorizar',
      rechazar: 'rechazar_jefe',
      aprobar: 'aprobar',
      emitirOrden: 'emitir_orden',
      cerrar: 'cerrar',
    } as const;
    return canPerformCompraAction(role, map[a.key], solicitud.estado, { isOwner });
  });

  const handleUpdate = async (data: CreateCompraSolicitudInput) => {
    await updateSolicitud({ id, data });
    sileo.success({ title: 'Solicitud actualizada' });
    refetch();
  };

  const handleAction = async (action: typeof actions[number]['key']) => {
    try {
      if (action === 'rechazar' && !motivoRechazo.trim()) {
        sileo.error({ title: 'Motivo requerido', description: 'Indique el motivo de rechazo' });
        return;
      }
      await runWorkflow({
        id,
        action,
        body: action === 'rechazar' ? { motivoRechazo } : undefined,
      });
      sileo.success({ title: 'Acción registrada' });
      refetch();
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo ejecutar la acción',
      });
    }
  };

  const handleRegenerateDocument = async () => {
    try {
      await regenerateDocument(id);
      sileo.success({ title: 'Documento regenerado' });
      refetch();
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo regenerar el documento',
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title={solicitud.codigoSolicitud}
        description="Detalle de solicitud y orden de compra"
      >
        <div className="flex flex-wrap gap-2">
          {documentoActivo && (
            <>
              <Button variant="outline" onClick={() => setShowPdfViewer((v) => !v)}>
                <Eye className="h-4 w-4 mr-2" /> Ver documento
              </Button>
              <Button variant="outline" asChild>
                <a href={comprasService.documentoUrl(id, true)} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 mr-2" /> Descargar PDF
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={comprasService.documentoUrl(id)} target="_blank" rel="noreferrer">
                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                </a>
              </Button>
            </>
          )}
          {canRegenerateDoc && (
            <Button variant="outline" onClick={handleRegenerateDocument} disabled={isRegeneratingDocument}>
              <RefreshCw className="h-4 w-4 mr-2" /> Regenerar PDF
            </Button>
          )}
          <Button variant="outline" asChild><Link href="/compras">Volver</Link></Button>
        </div>
      </PageHeader>

      <div className="mb-4 flex items-center gap-3">
        <CompraStatusBadge estado={solicitud.estado} />
        <span className="text-sm text-muted-foreground">
          Solicitante: {solicitud.solicitadoPor?.firstName} {solicitud.solicitadoPor?.lastName}
        </span>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Documento institucional</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {documentoActivo ? (
            <>
              <p><strong>Archivo:</strong> {documentoActivo.nombreArchivo}</p>
              <p><strong>Versión:</strong> {documentoActivo.version}</p>
              <p><strong>Generado:</strong> {new Date(documentoActivo.generadoEn).toLocaleString('es-HN')}</p>
              {documentoActivo.generadoPor && (
                <p><strong>Por:</strong> {documentoActivo.generadoPor.firstName} {documentoActivo.generadoPor.lastName}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Aún no hay documento PDF generado para esta solicitud.</p>
          )}
        </CardContent>
      </Card>

      {showPdfViewer && documentoActivo && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Vista previa del documento</CardTitle></CardHeader>
          <CardContent>
            <iframe
              title={`PDF ${solicitud.codigoSolicitud}`}
              src={comprasService.documentoUrl(id)}
              className="w-full min-h-[70vh] rounded border"
            />
          </CardContent>
        </Card>
      )}

      {actions.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Firmas y aprobaciones</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-end">
            {actions.map((action) => (
              <Button key={action.key} size="sm" onClick={() => handleAction(action.key)} disabled={isSaving}>
                <action.icon className="h-4 w-4 mr-1" /> {action.label}
              </Button>
            ))}
            {actions.some((a) => a.key === 'rechazar') && (
              <Input
                placeholder="Motivo de rechazo"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                className="max-w-xs"
              />
            )}
          </CardContent>
        </Card>
      )}

      <CompraForm
        departments={departments}
        centros={centros}
        proveedores={proveedores}
        defaultValues={solicitud}
        onSubmit={handleUpdate}
        isSubmitting={isSaving}
        readOnly={!editable}
      />

      {solicitud.adjuntos?.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Adjuntos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {solicitud.adjuntos.map((adj) => (
              <a key={adj.id} href={adj.url} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline">
                {adj.nombre}
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
}
