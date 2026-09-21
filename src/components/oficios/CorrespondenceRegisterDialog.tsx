'use client';

import { useEffect, useState } from 'react';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { OficioFileUpload } from '@/components/oficios/OficioFileUpload';
import {
  RelatedCorrespondenceSelector,
  type RelatedCorrespondenceSelection,
} from '@/components/oficios/RelatedCorrespondenceSelector';
import { uploadsService } from '@/services/uploads.service';
import { oficiosService } from '@/services/oficios.service';
import {
  OFICIO_DEPENDENCY_LABELS,
  OFICIO_DOCUMENT_KINDS,
  OFICIO_DOCUMENT_KIND_LABELS,
  type OficioDirection,
  type OficioScope,
} from '@/lib/oficios-numbering';
import type { CreateOficioData } from '@/types';

type Step = 'direction' | 'dependency' | 'form';

const EMPTY = {
  documentKind: 'OFICIO',
  documentNumber: '',
  oficioDate: new Date().toISOString().slice(0, 10),
  receivedAt: new Date().toISOString().slice(0, 10),
  institution: '',
  personName: '',
  personPosition: '',
  preparedBy: '',
  subject: '',
  notes: '',
  cc: '',
  signerId: '',
};

export function CorrespondenceRegisterDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateOficioData) => Promise<unknown>;
  isSubmitting?: boolean;
}) {
  const [step, setStep] = useState<Step>('direction');
  const [direction, setDirection] = useState<OficioDirection | null>(null);
  const [dependency, setDependency] = useState<OficioScope | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [related, setRelated] = useState<RelatedCorrespondenceSelection | null>(null);
  const [nextNumber, setNextNumber] = useState<string | null>(null);
  const [signers, setSigners] = useState<{ id: string; name: string; positionTitle: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('direction');
      setDirection(null);
      setDependency(null);
      setForm(EMPTY);
      setSelectedFile(null);
      setRelated(null);
      setNextNumber(null);
      setUploading(false);
    }
  }, [open]);

  useEffect(() => {
    if (step !== 'form' || !dependency || direction !== 'OUTGOING') {
      setNextNumber(null);
      return;
    }
    const year = new Date(form.oficioDate || Date.now()).getFullYear();
    void oficiosService
      .previewNumber({ dependency, year })
      .then((res) => setNextNumber(res.data.nextNumber))
      .catch(() => setNextNumber(null));
  }, [step, dependency, direction, form.oficioDate]);

  useEffect(() => {
    if (step !== 'form' || !dependency || direction !== 'OUTGOING') return;
    void oficiosService
      .listSigners({ dependency })
      .then((res) => setSigners(res.data.signers))
      .catch(() => setSigners([]));
  }, [step, dependency, direction]);

  const handleCreate = async () => {
    if (!direction || !dependency) return;
    if (!form.subject.trim() || !form.institution.trim()) {
      sileo.error({ title: 'Complete asunto e institución' });
      return;
    }
    if (direction === 'INCOMING' && !form.documentNumber.trim()) {
      sileo.error({ title: 'Indique el número externo del documento' });
      return;
    }
    if (!selectedFile) {
      sileo.error({ title: 'Adjunte el PDF o escaneo oficial' });
      return;
    }

    try {
      setUploading(true);
      const attachment = await uploadsService.uploadOficioDocument(selectedFile);
      await onSubmit({
        scope: dependency,
        dependency,
        direction,
        documentKind: form.documentKind,
        subject: form.subject.trim(),
        institution: form.institution.trim(),
        preparedBy: form.preparedBy.trim() || undefined,
        oficioDate: form.oficioDate,
        receivedDate: direction === 'INCOMING' ? form.receivedAt : undefined,
        externalNumber: direction === 'INCOMING' ? form.documentNumber.trim() : undefined,
        recipient: direction === 'OUTGOING' ? form.personName.trim() : form.personName.trim() || undefined,
        recipientName: direction === 'OUTGOING' ? form.personName.trim() : undefined,
        recipientPosition: direction === 'OUTGOING' ? form.personPosition.trim() : undefined,
        senderName: direction === 'INCOMING' ? form.personName.trim() : undefined,
        senderPosition: direction === 'INCOMING' ? form.personPosition.trim() : undefined,
        cc: form.cc.trim() || undefined,
        comments: form.notes.trim() || undefined,
        responseToId: related?.id || undefined,
        signerId: form.signerId || undefined,
        attachments: [attachment],
      });
      sileo.success({ title: 'Correspondencia registrada' });
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      sileo.error({
        title: 'No se pudo registrar',
        description: err.response?.data?.error ?? err.message ?? 'Error desconocido',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar correspondencia</DialogTitle>
          <DialogDescription>
            {step === 'direction' && '¿Qué desea registrar?'}
            {step === 'dependency' && 'Seleccione la dependencia institucional'}
            {step === 'form' &&
              `${direction === 'INCOMING' ? 'Entrada' : 'Salida'} — ${dependency ? OFICIO_DEPENDENCY_LABELS[dependency] : ''}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'direction' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-24 flex-col"
              onClick={() => {
                setDirection('INCOMING');
                setStep('dependency');
              }}
            >
              Entrada
              <span className="text-xs font-normal text-muted-foreground">Documento recibido</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col"
              onClick={() => {
                setDirection('OUTGOING');
                setStep('dependency');
              }}
            >
              Salida
              <span className="text-xs font-normal text-muted-foreground">Documento emitido</span>
            </Button>
          </div>
        ) : null}

        {step === 'dependency' ? (
          <div className="grid gap-3">
            {(['CNI', 'DESPACHO'] as const).map((dep) => (
              <Button
                key={dep}
                variant="outline"
                className="h-16 justify-start"
                onClick={() => {
                  setDependency(dep);
                  setStep('form');
                }}
              >
                {OFICIO_DEPENDENCY_LABELS[dep]}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setStep('direction')}>
              Volver
            </Button>
          </div>
        ) : null}

        {step === 'form' && direction && dependency ? (
          <div className="space-y-4">
            {direction === 'OUTGOING' && nextNumber ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                Próximo número: <strong>{nextNumber}</strong>
              </div>
            ) : null}
            {direction === 'OUTGOING' && !nextNumber ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No hay configuración de numeración activa. Un administrador técnico debe
                configurarla en Configuración → Correspondencia.
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select
                  value={form.documentKind}
                  onValueChange={(v) => setForm((f) => ({ ...f, documentKind: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFICIO_DOCUMENT_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {OFICIO_DOCUMENT_KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha del documento</Label>
                <Input
                  type="date"
                  value={form.oficioDate}
                  onChange={(e) => setForm((f) => ({ ...f, oficioDate: e.target.value }))}
                />
              </div>
            </div>

            {direction === 'INCOMING' ? (
              <>
                <div className="space-y-2">
                  <Label>Número externo (tal como llega)</Label>
                  <Input
                    value={form.documentNumber}
                    onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))}
                    placeholder="Ej. 773/DE/INM-2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de recepción</Label>
                  <Input
                    type="date"
                    value={form.receivedAt}
                    onChange={(e) => setForm((f) => ({ ...f, receivedAt: e.target.value }))}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2">
              <Label>
                {direction === 'INCOMING' ? 'Institución remitente' : 'Institución destinataria'}
              </Label>
              <Input
                value={form.institution}
                onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  {direction === 'INCOMING' ? 'Nombre del remitente' : 'Nombre del destinatario'}
                </Label>
                <Input
                  value={form.personName}
                  onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={form.personPosition}
                  onChange={(e) => setForm((f) => ({ ...f, personPosition: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Asunto</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>

            {direction === 'OUTGOING' && signers.length > 0 ? (
              <div className="space-y-2">
                <Label>Firmante</Label>
                <Select
                  value={form.signerId || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, signerId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar firmante" />
                  </SelectTrigger>
                  <SelectContent>
                    {signers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.positionTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {direction === 'OUTGOING' ? (
              <div className="space-y-2">
                <Label>CC / Copias</Label>
                <Input
                  value={form.cc}
                  onChange={(e) => setForm((f) => ({ ...f, cc: e.target.value }))}
                />
              </div>
            ) : null}

            <RelatedCorrespondenceSelector
              value={related}
              onChange={setRelated}
              disabled={isSubmitting || uploading}
            />

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Adjunto / PDF</Label>
              <OficioFileUpload
                file={selectedFile}
                onFileChange={setSelectedFile}
                disabled={isSubmitting || uploading}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setStep('dependency')}>
                Volver
              </Button>
              <Button onClick={() => void handleCreate()} disabled={isSubmitting || uploading}>
                {uploading || isSubmitting ? 'Guardando…' : 'Registrar'}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
