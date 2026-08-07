'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import {
  ArrowLeft, FileText, Image as ImageIcon, Download, ExternalLink,
  Upload, User, Calendar, Building2, FileSignature, History,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useOficioDetail, useAddOficioDocument, useUpdateOficioStatus } from '@/hooks/useOficios';
import { OficioStatusBadge } from '@/components/oficios/OficioStatusBadge';
import { sileo } from 'sileo';
import {
  OFICIO_DOCUMENT_TYPE_LABELS,
  OFICIO_RECORD_SOURCE_LABELS,
  OFICIO_STATUS_LABELS,
  OFICIO_TRACKING_ACTION_LABELS,
  OFICIO_TYPE_LABELS,
  type OficioStatus,
} from '@/types';
import {
  OFICIO_STATUS_TRANSITIONS,
} from '@/lib/oficios-status-transitions';

const STATUS_NEXT: Record<OficioStatus, OficioStatus[]> = {
  DRAFT: [...OFICIO_STATUS_TRANSITIONS.DRAFT],
  SENT: [...OFICIO_STATUS_TRANSITIONS.SENT],
  RECEIVED: [...OFICIO_STATUS_TRANSITIONS.RECEIVED],
  IN_PROCESS: [...OFICIO_STATUS_TRANSITIONS.IN_PROCESS],
  COMPLETED: [...OFICIO_STATUS_TRANSITIONS.COMPLETED],
  ARCHIVED: [...OFICIO_STATUS_TRANSITIONS.ARCHIVED],
};

export default function OficioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { oficio, isLoading, refetch } = useOficioDetail(id);
  const updateStatus = useUpdateOficioStatus(id);
  const addDocument = useAddOficioDocument(id);

  if (isLoading) {
    return <MainLayout><div className="p-8">Cargando oficio…</div></MainLayout>;
  }
  if (!oficio) {
    return (
      <MainLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Oficio no encontrado.</p>
          <Button asChild variant="link"><Link href="/oficios/todos">Volver al repositorio</Link></Button>
        </div>
      </MainLayout>
    );
  }

  const primaryDoc = oficio.documents?.find((d) => d.isPrimary) ?? oficio.documents?.[0];
  const tracking = oficio.tracking ?? [];
  const otherDocs = oficio.documents?.filter((d) => d.id !== primaryDoc?.id) ?? [];

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus.mutateAsync(newStatus);
      sileo.success({ title: 'Estado actualizado', description: OFICIO_STATUS_LABELS[newStatus as OficioStatus] });
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo cambiar el estado',
      });
    }
  };

  const handleAddDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('documentType', 'ANEXO');
    try {
      await addDocument.mutateAsync(fd);
      sileo.success({ title: 'Documento agregado', description: file.name });
      e.target.value = '';
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo subir',
      });
    }
  };

  const scopeLabel =
    oficio.scope === 'INTERNO' ? 'Interno / Memo'
    : oficio.scope === 'CNI' ? 'Externo CNI'
    : oficio.scope === 'DESPACHO' ? 'Externo Despacho'
    : oficio.scope ?? 'Sin clasificar';

  const allowedNext = STATUS_NEXT[oficio.status] ?? [];

  return (
    <MainLayout>
      <PageHeader
        title={`Oficio ${oficio.number}`}
        description={oficio.subject}
      >
        <Button asChild variant="outline">
          <Link href="/oficios/todos"><ArrowLeft className="h-4 w-4 mr-2" /> Repositorio</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Columna principal ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos generales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" /> Datos generales
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field icon={FileText} label="No. de Oficio" value={oficio.number} mono />
              {oficio.systemNumber && (
                <Field icon={FileText} label="No. interno" value={oficio.systemNumber} mono />
              )}
              <Field icon={FileSignature} label="Submódulo" value={scopeLabel} />
              <Field icon={FileText} label="Movimiento" value={OFICIO_TYPE_LABELS[oficio.type]} />
              <Field icon={Building2} label="Institución" value={oficio.institution ?? '—'} />
              <Field icon={User} label="Destinatario" value={oficio.recipient ?? '—'} />
              <Field icon={User} label="Elaborado por" value={oficio.preparedBy ?? '—'} />
              <Field icon={Calendar} label="Fecha original" value={new Date(oficio.oficioDate).toLocaleDateString('es-HN')} />
              {oficio.receivedDate && (
                <Field icon={Calendar} label="Recibido" value={new Date(oficio.receivedDate).toLocaleDateString('es-HN')} />
              )}
              {oficio.sentDate && (
                <Field icon={Calendar} label="Enviado" value={new Date(oficio.sentDate).toLocaleDateString('es-HN')} />
              )}
              <div className="md:col-span-2">
                <Field icon={FileText} label="Motivo" value={oficio.subject} />
              </div>
              {oficio.comments && (
                <div className="md:col-span-2">
                  <Field label="Comentarios" value={oficio.comments} multiline />
                </div>
              )}
              <div className="md:col-span-2 flex items-center gap-2 pt-2 border-t">
                <Badge variant="outline" className="font-normal">
                  {OFICIO_RECORD_SOURCE_LABELS[oficio.recordSource]}
                </Badge>
                <OficioStatusBadge status={oficio.status} />
                {oficio.importedBy && (
                  <span className="text-xs text-muted-foreground">
                    Importado por {oficio.importedBy.firstName} {oficio.importedBy.lastName}
                    {oficio.importedAt && ` el ${new Date(oficio.importedAt).toLocaleDateString('es-HN')}`}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documento principal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {primaryDoc?.mimeType.startsWith('image/') ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                Documento principal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {primaryDoc ? (
                <DocumentViewer doc={primaryDoc} />
              ) : (
                <EmptyDocuments onAdd={handleAddDocument} />
              )}
            </CardContent>
          </Card>

          {/* Documentos relacionados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Documentos relacionados ({otherDocs.length})
                </span>
                <Button asChild size="sm" variant="outline">
                  <label className="cursor-pointer">
                    <Upload className="h-3.5 w-3.5 mr-1" /> Agregar
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="hidden"
                      onChange={handleAddDocument}
                    />
                  </label>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {otherDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No hay documentos adicionales.
                </p>
              ) : (
                <ul className="space-y-2">
                  {otherDocs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {d.mimeType.startsWith('image/') ? <ImageIcon className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{d.originalName}</div>
                          <div className="text-xs text-muted-foreground">
                            {OFICIO_DOCUMENT_TYPE_LABELS[d.documentType as keyof typeof OFICIO_DOCUMENT_TYPE_LABELS] ?? d.documentType}
                            {' · '}
                            {(d.size / 1024).toFixed(1)} KB
                            {' · '}
                            {new Date(d.uploadedAt).toLocaleDateString('es-HN')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <a href={d.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <a href={d.url} download={d.originalName}>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Columna lateral ── */}
        <div className="space-y-6">
          {/* Cambio de estado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={oficio.status}
                onValueChange={handleStatusChange}
                disabled={updateStatus.isPending || allowedNext.length === 0}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={oficio.status}>{OFICIO_STATUS_LABELS[oficio.status]} (actual)</SelectItem>
                  {allowedNext.map((s) => (
                    <SelectItem key={s} value={s}>{OFICIO_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allowedNext.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Estado final
                </p>
              )}
            </CardContent>
          </Card>

          {/* Seguimiento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Seguimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tracking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin eventos de seguimiento aún.</p>
              ) : (
                <ol className="space-y-3">
                  {tracking.map((t) => (
                    <li key={t.id} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {OFICIO_TRACKING_ACTION_LABELS[t.action]}
                          {t.performedBy && ` · ${t.performedBy.firstName} ${t.performedBy.lastName}`}
                          {' · '}
                          {new Date(t.createdAt).toLocaleString('es-HN')}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Historial */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-muted-foreground">
              <div className="flex justify-between">
                <span>Creado en sistema</span>
                <span className="tabular-nums">{new Date(oficio.createdAt).toLocaleString('es-HN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Última actualización</span>
                <span className="tabular-nums">{new Date(oficio.updatedAt).toLocaleString('es-HN')}</span>
              </div>
              {oficio.createdBy && (
                <div className="flex justify-between">
                  <span>Creado por</span>
                  <span>{oficio.createdBy.firstName} {oficio.createdBy.lastName}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function DocumentViewer({ doc }: { doc: { url: string; mimeType: string; originalName: string } }) {
  const isPdf = doc.mimeType === 'application/pdf';
  const isImage = doc.mimeType.startsWith('image/');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="text-sm font-medium truncate">{doc.originalName}</div>
        <div className="flex gap-1">
          <Button asChild size="sm" variant="ghost">
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
            </a>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <a href={doc.url} download={doc.originalName}>
              <Download className="h-3.5 w-3.5 mr-1" /> Descargar
            </a>
          </Button>
        </div>
      </div>
      <div className="rounded-md border overflow-hidden bg-muted/10">
        {isPdf ? (
          <iframe
            src={doc.url}
            title={doc.originalName}
            className="w-full h-[600px]"
          />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.url} alt={doc.originalName} className="w-full h-auto max-h-[600px] object-contain" />
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Formato no previsualizable. Use los botones para abrir o descargar.
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyDocuments({ onAdd }: { onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="rounded-md border border-dashed p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground mb-3">Este oficio no tiene documentos.</p>
      <Button asChild variant="outline" size="sm">
        <label className="cursor-pointer">
          <Upload className="h-3.5 w-3.5 mr-1" /> Subir documento
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={onAdd}
          />
        </label>
      </Button>
    </div>
  );
}

function Field({
  icon: Icon, label, value, mono, multiline,
}: {
  icon?: typeof User;
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={`text-sm ${mono ? 'font-mono' : ''} ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {value || '—'}
      </div>
    </div>
  );
}
