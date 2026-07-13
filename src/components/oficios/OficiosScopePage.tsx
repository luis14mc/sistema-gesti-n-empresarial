'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import {
  Plus, Search, Trash2, Edit3,
  Send, FileCheck, Archive, ArrowRight, History,
  Paperclip, FileX,
} from 'lucide-react';
import { OficioFileUpload } from '@/components/oficios/OficioFileUpload';
import { OficioDocumentViewer } from '@/components/oficios/OficioDocumentViewer';
import { uploadsService } from '@/services/uploads.service';
import { parseOficioAttachments, hasOficioDocument } from '@/lib/oficios-attachments';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useOficios, useOficioDetail } from '@/hooks/useOficios';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { canAccess } from '@/lib/permissions';
import {
  OFICIO_SCOPE_LABELS,
  getAutoNumberHint,
  type OficioScope,
  type OficioDirection,
} from '@/lib/oficios-numbering';
import {
  resolveOficioFields,
  getInstitutionLabel,
  getInstitutionPlaceholder,
} from '@/lib/oficios-fields';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import type { Role, OficioStatus, CreateOficioData, OficioDirection as OficioDirectionType, User } from '@/types';

// ── Constants ─────────────────────────────────────────────────

type DirectionFilter = 'ALL' | 'INCOMING' | 'OUTGOING';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200',
  SENT: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200',
  RECEIVED: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200',
  IN_PROCESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200',
  COMPLETED: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200',
  ARCHIVED: 'bg-muted text-muted-foreground border-border',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', SENT: 'Enviado', RECEIVED: 'Recibido',
  IN_PROCESS: 'En Proceso', COMPLETED: 'Completado', ARCHIVED: 'Archivado',
};

const STATUS_TRANSITIONS: Record<string, { next: OficioStatus; label: string; icon: typeof ArrowRight }[]> = {
  DRAFT: [{ next: 'SENT', label: 'Enviar', icon: Send }],
  SENT: [{ next: 'RECEIVED', label: 'Marcar recibido', icon: FileCheck }],
  RECEIVED: [{ next: 'IN_PROCESS', label: 'En proceso', icon: ArrowRight }],
  IN_PROCESS: [{ next: 'COMPLETED', label: 'Completar', icon: FileCheck }],
  COMPLETED: [{ next: 'ARCHIVED', label: 'Archivar', icon: Archive }],
  ARCHIVED: [],
};

const TAB_TITLES: Record<OficioScope, string> = {
  INTERNO: 'Oficios Internos / Memos',
  CNI: 'Oficios Externos CNI',
  DESPACHO: 'Oficios Externos Despacho',
};

const EMPTY_FORM = {
  number: '',
  recipient: '',
  institution: '',
  motivo: '',
  preparedBy: '',
  oficioDate: '',
};

function resolveCreateDirection(scope: OficioScope, filter: DirectionFilter): OficioDirection {
  if (scope === 'INTERNO') return 'INTERNAL_MEMO';
  if (filter === 'INCOMING') return 'INCOMING';
  if (filter === 'OUTGOING') return 'OUTGOING';
  return 'OUTGOING';
}

function resolveListDirection(scope: OficioScope, filter: DirectionFilter): OficioDirectionType | undefined {
  if (scope === 'INTERNO') return 'INTERNAL_MEMO';
  if (filter === 'ALL') return undefined;
  return filter;
}

// ── Scope Page ────────────────────────────────────────────────

export interface OficiosScopePageProps {
  scope: OficioScope;
}

export function OficiosScopePage({ scope }: OficiosScopePageProps) {
  const { user } = useAuth();
  const role = (user?.role ?? 'USER') as Role;
  const canCreate = canAccess(role, 'oficios', 'create');
  const canDelete = canAccess(role, 'oficios', 'delete');

  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOficioId, setSelectedOficioId] = useState<string | null>(null);

  useEffect(() => {
    setDirectionFilter('ALL');
    setPage(1);
    setSearch('');
    setSelectedOficioId(null);
  }, [scope]);

  const listDirection = resolveListDirection(scope, directionFilter);

  const { oficios, totalPages, isLoading, createOficio, isCreating, deleteOficio, isDeleting } = useOficios({
    search: debouncedSearch || undefined,
    scope,
    direction: listDirection,
    page,
    pageSize: 10,
  });

  const handleDirectionFilter = (filter: DirectionFilter) => {
    setDirectionFilter(filter);
    setPage(1);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={TAB_TITLES[scope]}
          description={OFICIO_SCOPE_LABELS[scope]}
        >
          {canCreate && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo oficio
            </Button>
          )}
        </PageHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {scope !== 'INTERNO' && (
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {(['ALL', 'INCOMING', 'OUTGOING'] as DirectionFilter[]).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={directionFilter === f ? 'default' : 'outline'}
                    onClick={() => handleDirectionFilter(f)}
                  >
                    {f === 'ALL' ? 'Todos' : f === 'INCOMING' ? 'Ingresados' : 'Enviados'}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, motivo, institución..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Oficio</TableHead>
                    <TableHead className="hidden md:table-cell">Institución</TableHead>
                    <TableHead className="hidden lg:table-cell">Destinatario</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="hidden xl:table-cell">Elaborado por</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead className="w-10 text-center">Doc.</TableHead>
                    <TableHead>Estado</TableHead>
                    {canDelete && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={canDelete ? 9 : 8}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : oficios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canDelete ? 9 : 8} className="text-center py-12 text-muted-foreground">
                        No se encontraron oficios en esta vista
                      </TableCell>
                    </TableRow>
                  ) : (
                    oficios.map((oficio) => {
                      const fields = resolveOficioFields(oficio);
                      return (
                      <TableRow
                        key={oficio.id}
                        className="cursor-pointer hover:bg-accent/40 transition-colors"
                        onClick={() => setSelectedOficioId(oficio.id)}
                      >
                        <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">
                          {oficio.number}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm line-clamp-1">
                          {fields.institution}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm line-clamp-1">
                          {fields.recipient}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium line-clamp-1">{oficio.subject}</p>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-sm line-clamp-1">
                          {fields.preparedBy}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {oficio.oficioDate
                            ? format(new Date(oficio.oficioDate), 'dd/MM/yyyy', { locale: es })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          {hasOficioDocument(oficio.attachments) ? (
                            <Paperclip className="h-4 w-4 text-primary mx-auto" aria-label="Con documento" />
                          ) : (
                            <FileX className="h-4 w-4 text-muted-foreground/50 mx-auto" aria-label="Sin documento" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[oficio.status]}>
                            {STATUS_LABELS[oficio.status] ?? oficio.status}
                          </Badge>
                        </TableCell>
                        {canDelete && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={isDeleting}
                              onClick={async () => {
                                const ok = await swalConfirm(
                                  '¿Eliminar oficio?',
                                  `Se eliminará "${oficio.subject}" permanentemente.`,
                                  'Sí, eliminar'
                                );
                                if (!ok.isConfirmed) return;
                                try {
                                  await deleteOficio(oficio.id);
                                  if (selectedOficioId === oficio.id) setSelectedOficioId(null);
                                  sileo.success({ title: 'Oficio eliminado' });
                                } catch {
                                  sileo.error({ title: 'Error', description: 'No se pudo eliminar' });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} isLoading={isLoading} />
          </Card>
        </div>
      </div>

      <OficioCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        scope={scope}
        direction={resolveCreateDirection(scope, directionFilter)}
        user={user}
        isCreating={isCreating}
        onSubmit={async (data) => {
          try {
            await createOficio(data);
            sileo.success({ title: 'Oficio registrado', description: 'El documento se creó correctamente' });
            setDialogOpen(false);
          } catch {
            sileo.error({ title: 'Error', description: 'No se pudo crear el oficio' });
          }
        }}
      />

      <Sheet open={selectedOficioId !== null} onOpenChange={(open) => { if (!open) setSelectedOficioId(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedOficioId && (
            <OficioDetailPanel
              oficioId={selectedOficioId}
              role={role}
              onClose={() => setSelectedOficioId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}

// ── Create Dialog ─────────────────────────────────────────────

interface OficioCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: OficioScope;
  direction: OficioDirection;
  user: User | null;
  isCreating: boolean;
  onSubmit: (data: CreateOficioData) => Promise<void>;
}

function OficioCreateDialog({
  open,
  onOpenChange,
  scope,
  direction: initialDirection,
  user,
  isCreating,
  onSubmit,
}: OficioCreateDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [createDirection, setCreateDirection] = useState<OficioDirection>(initialDirection);

  const direction = scope === 'INTERNO' ? 'INTERNAL_MEMO' : createDirection;
  const isIncoming = direction === 'INCOMING';
  const isGenerated = direction === 'OUTGOING' || direction === 'INTERNAL_MEMO';
  const isBusy = isCreating || isUploading;
  const autoNumberHint = getAutoNumberHint(scope, direction);

  const defaultPreparedBy = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : '';

  useEffect(() => {
    if (open) {
      setCreateDirection(initialDirection);
      setForm({
        ...EMPTY_FORM,
        preparedBy: defaultPreparedBy,
        institution: scope === 'INTERNO' ? 'CNI' : '',
      });
      setSelectedFile(null);
    }
  }, [open, initialDirection, scope, defaultPreparedBy]);

  const resetAndClose = (next: boolean) => {
    if (!next) {
      setForm(EMPTY_FORM);
      setSelectedFile(null);
      setCreateDirection(initialDirection);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isIncoming && !form.number.trim()) {
      sileo.error({ title: 'No. de Oficio requerido' });
      return;
    }
    if (!form.recipient.trim()) {
      sileo.error({ title: 'Destinatario requerido' });
      return;
    }
    if (!form.institution.trim()) {
      sileo.error({ title: 'Institución requerida' });
      return;
    }
    if (!form.motivo.trim()) {
      sileo.error({ title: 'Motivo requerido' });
      return;
    }
    if (!form.preparedBy.trim()) {
      sileo.error({ title: 'Elaborado Por es requerido' });
      return;
    }
    if (!form.oficioDate) {
      sileo.error({ title: 'Fecha requerida' });
      return;
    }
    if (!selectedFile) {
      sileo.error({ title: 'Documento requerido', description: 'Debes seleccionar el archivo oficial del oficio.' });
      return;
    }

    try {
      setIsUploading(true);
      const attachment = await uploadsService.uploadOficioDocument(selectedFile);
      setIsUploading(false);

      await onSubmit({
        scope,
        direction,
        number: isIncoming ? form.number.trim() : undefined,
        externalNumber: isIncoming ? form.number.trim() : undefined,
        recipient: form.recipient.trim(),
        institution: form.institution.trim(),
        subject: form.motivo.trim(),
        preparedBy: form.preparedBy.trim(),
        oficioDate: form.oficioDate,
        attachments: [attachment],
      });
      setForm(EMPTY_FORM);
      setSelectedFile(null);
    } catch (err) {
      setIsUploading(false);
      sileo.error({
        title: 'Error al registrar',
        description: err instanceof Error ? err.message : 'No se pudo subir el documento o crear el oficio',
      });
    }
  };

  const title =
    scope === 'INTERNO'
      ? 'Nuevo memo interno'
      : isIncoming
        ? `Registrar oficio ingresado — ${OFICIO_SCOPE_LABELS[scope]}`
        : `Nuevo oficio enviado — ${OFICIO_SCOPE_LABELS[scope]}`;

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Complete los datos institucionales y adjunte el documento oficial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {scope !== 'INTERNO' && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={createDirection === 'OUTGOING' ? 'default' : 'outline'}
                onClick={() => setCreateDirection('OUTGOING')}
              >
                Enviado
              </Button>
              <Button
                type="button"
                size="sm"
                variant={createDirection === 'INCOMING' ? 'default' : 'outline'}
                onClick={() => setCreateDirection('INCOMING')}
              >
                Ingresado
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="number">No. Oficio *</Label>
            {isIncoming ? (
              <Input
                id="number"
                placeholder="Ej. Oficio No. 123-2026 / Nota ABC-045-2026"
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                {autoNumberHint}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Destinatario *</Label>
            <Input
              id="recipient"
              placeholder="Persona o unidad destinataria"
              value={form.recipient}
              onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution">{getInstitutionLabel(scope, direction)}</Label>
            <Input
              id="institution"
              placeholder={getInstitutionPlaceholder(scope, direction)}
              value={form.institution}
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Input
              id="motivo"
              placeholder="Motivo o asunto del documento"
              value={form.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preparedBy">Elaborado Por *</Label>
            <Input
              id="preparedBy"
              placeholder="Nombre de quien elaboró el oficio"
              value={form.preparedBy}
              onChange={(e) => setForm((f) => ({ ...f, preparedBy: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="oficioDate">Fecha *</Label>
            <Input
              id="oficioDate"
              type="date"
              value={form.oficioDate}
              onChange={(e) => setForm((f) => ({ ...f, oficioDate: e.target.value }))}
            />
          </div>

          <OficioFileUpload
            file={selectedFile}
            onFileChange={setSelectedFile}
            disabled={isBusy}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => resetAndClose(false)}>Cancelar</Button>
            <Button type="submit" disabled={isBusy}>
              {isUploading ? 'Subiendo documento...' : isCreating ? 'Guardando...' : 'Registrar oficio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail Panel ──────────────────────────────────────────────

function OficioDetailPanel({
  oficioId,
  role,
  onClose,
}: {
  oficioId: string;
  role: Role;
  onClose: () => void;
}) {
  const { oficio, isLoading, updateOficio, isUpdating, deleteOficio, isDeleting } = useOficioDetail(oficioId);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    motivo: '',
    recipient: '',
    institution: '',
    preparedBy: '',
  });

  const canUpdate = canAccess(role, 'oficios', 'update');
  const canDelete = canAccess(role, 'oficios', 'delete');

  if (isLoading || !oficio) {
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const fields = resolveOficioFields(oficio);
  const attachments = parseOficioAttachments(oficio.attachments);
  const transitions = STATUS_TRANSITIONS[oficio.status] ?? [];

  return (
    <div className="space-y-6 pt-2">
      <SheetHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-1">No. Oficio</p>
            <SheetTitle className="text-lg font-heading leading-snug font-mono">{oficio.number}</SheetTitle>
          </div>
          <div className="flex gap-1 shrink-0">
            {(role === 'ADMIN' || role === 'IT') && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link href={`/admin/audit-logs?entityId=${oficioId}`}>
                  <History className="h-4 w-4" />
                </Link>
              </Button>
            )}
            {canUpdate && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                setEditForm({
                  motivo: oficio.subject,
                  recipient: fields.recipient === '—' ? '' : fields.recipient,
                  institution: fields.institution === '—' ? '' : fields.institution,
                  preparedBy: fields.preparedBy === '—' ? '' : fields.preparedBy,
                });
                setEditing(true);
              }}>
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                disabled={isDeleting}
                onClick={async () => {
                  const ok = await swalConfirm('¿Eliminar oficio?', `Se eliminará "${oficio.subject}".`, 'Sí, eliminar');
                  if (!ok.isConfirmed) return;
                  try {
                    await deleteOficio();
                    sileo.success({ title: 'Oficio eliminado' });
                    onClose();
                  } catch {
                    sileo.error({ title: 'Error' });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetHeader>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={STATUS_COLORS[oficio.status]}>
          {STATUS_LABELS[oficio.status] ?? oficio.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <DetailField label="Destinatario" value={fields.recipient} />
        <DetailField label="Institución" value={fields.institution} />
        <DetailField label="Motivo" value={oficio.subject} className="sm:col-span-2" />
        <DetailField label="Elaborado Por" value={fields.preparedBy} />
        <DetailField
          label="Fecha"
          value={oficio.oficioDate ? format(new Date(oficio.oficioDate), 'dd/MM/yyyy', { locale: es }) : '—'}
        />
      </div>

      <Separator />

      <div>
        <p className="text-sm font-semibold mb-3">Documento del oficio</p>
        <OficioDocumentViewer attachments={attachments} />
      </div>

      {canUpdate && transitions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Historial / Seguimiento — cambiar estado</p>
            <div className="flex flex-wrap gap-2">
              {transitions.map((t) => {
                const Icon = t.icon;
                return (
                  <Button
                    key={t.next}
                    variant="outline"
                    size="sm"
                    disabled={isUpdating}
                    onClick={async () => {
                      try {
                        await updateOficio({ status: t.next });
                        sileo.success({ title: `Estado: ${STATUS_LABELS[t.next]}` });
                      } catch {
                        sileo.error({ title: 'Error al actualizar estado' });
                      }
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" /> {t.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar oficio</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await updateOficio({
                  subject: editForm.motivo,
                  recipient: editForm.recipient,
                  institution: editForm.institution,
                  preparedBy: editForm.preparedBy,
                });
                setEditing(false);
                sileo.success({ title: 'Oficio actualizado' });
              } catch {
                sileo.error({ title: 'Error al guardar' });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Destinatario</Label>
              <Input value={editForm.recipient} onChange={(e) => setEditForm((f) => ({ ...f, recipient: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Institución</Label>
              <Input value={editForm.institution} onChange={(e) => setEditForm((f) => ({ ...f, institution: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input value={editForm.motivo} onChange={(e) => setEditForm((f) => ({ ...f, motivo: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Elaborado Por</Label>
              <Input value={editForm.preparedBy} onChange={(e) => setEditForm((f) => ({ ...f, preparedBy: e.target.value }))} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button type="submit" disabled={isUpdating}>{isUpdating ? 'Guardando...' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}
