'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Plus, Search } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEquipment } from '@/hooks/useEquipment';
import { useEquipmentDisposals } from '@/hooks/useEquipmentDisposals';
import { disposalEvaluationSchema, type DisposalEvaluationInput } from '@/modules/equipment-disposal/presentation/schemas/disposal';
import { can, organizationRole } from '@/platform/security/authorization/permissions';
import { swalConfirm, swalError, swalSuccess } from '@/lib/swal';
import Swal from 'sweetalert2';
import { getApiErrorData, getApiErrorMessage, getHttpStatus } from '@/lib/api-error';
import Link from 'next/link';

const STATUS_LABELS = { DRAFT: 'Borrador', PENDING_APPROVAL: 'Pendiente', APPROVED: 'Aprobado', REJECTED: 'Rechazado', CANCELLED: 'Cancelado' } as const;

export default function EquipmentDisposalPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const disposals = useEquipmentDisposals({ page, pageSize: 20, search: search || undefined });
  const organizationId = disposals.organization.data?.organization.id;
  const equipment = useEquipment(
    { page: 1, pageSize: 100 },
    { enabled: disposals.organization.isSuccess && Boolean(organizationId), organizationId },
  );
  const role = disposals.organization.data?.membership.role;
  const organizationErrorShown = useRef(false);

  useEffect(() => {
    if (!disposals.organization.error || organizationErrorShown.current) return;
    organizationErrorShown.current = true;
    const status = getHttpStatus(disposals.organization.error);
    const code = getApiErrorData(disposals.organization.error).error;
    const message = status === 409 || code === 'ORGANIZATION_SELECTION_REQUIRED'
      ? 'Seleccione la organización con la que desea trabajar.'
      : 'No tiene acceso a una organización activa. Solicite al administrador que asigne su usuario.';
    void swalError('Organización no disponible', message);
  }, [disposals.organization.error]);
  const form = useForm<z.input<typeof disposalEvaluationSchema>, unknown, DisposalEvaluationInput>({
    resolver: zodResolver(disposalEvaluationSchema),
    defaultValues: { purchasePrice: 0, estimatedRepairCost: 0, estimatedReplacementPrice: 0, physicalCondition: 'FAIR', functionalCondition: 'SLOW', securitySupportStatus: 'LIMITED_SUPPORT', technicalNotes: '' },
  });

  const submit = form.handleSubmit(async (data) => {
    try {
      const response = await disposals.create.mutateAsync(data);
      setOpen(false);
      form.reset();
      await swalSuccess('Borrador creado', `Se asignó el folio ${response.data.data.folio}.`);
    } catch (error) {
      await swalError('No se pudo crear el dictamen', getApiErrorMessage(error, 'Revise los datos e intente nuevamente.'));
    }
  });

  const runCommand = async (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel') => {
    let reason: string | undefined;
    if (action === 'reject' || action === 'cancel') {
      const result = await Swal.fire({ title: action === 'reject' ? 'Rechazar dictamen' : 'Cancelar dictamen', input: 'textarea', inputLabel: 'Motivo', showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Volver', inputValidator: (value) => value.trim().length < 5 ? 'Ingrese al menos 5 caracteres.' : undefined });
      if (!result.isConfirmed) return;
      reason = result.value;
    } else {
      const result = await swalConfirm(action === 'approve' ? '¿Aprobar dictamen?' : '¿Enviar a aprobación?', 'Esta acción cambiará el estado del activo.', 'Confirmar');
      if (!result.isConfirmed) return;
    }
    try {
      await disposals.command.mutateAsync({ id, action, reason });
      await swalSuccess('Acción completada');
    } catch (error) {
      await swalError('No se pudo completar la acción', getApiErrorMessage(error, 'Ocurrió un error inesperado.'));
    }
  };

  const items = disposals.query.data?.items ?? [];
  return <MainLayout><div className="space-y-6 font-[Aptos,'Segoe_UI',sans-serif]">
    <PageHeader title="Dictámenes de baja" description="Diagnóstico, evaluación y aprobación de bajas de equipo">{role && can(organizationRole(role), 'equipment-disposal.create') ? <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nuevo dictamen</Button> : null}</PageHeader>
    <Card><CardContent className="pt-6"><div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar folio, inventario o serie" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div></CardContent></Card>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Activo</TableHead><TableHead>Equipo</TableHead><TableHead>Puntuación</TableHead><TableHead>Estado</TableHead><TableHead>Evidencias</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>
      {disposals.query.isLoading ? <TableRow><TableCell colSpan={7} className="py-12 text-center">Cargando dictámenes...</TableCell></TableRow> : items.length === 0 ? <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No hay dictámenes registrados.</TableCell></TableRow> : items.map((item) => <TableRow key={item.id}><TableCell className="font-mono font-medium">{item.folio}</TableCell><TableCell>{item.equipment.inventoryCode}</TableCell><TableCell>{item.brand} {item.model}</TableCell><TableCell>{item.evaluationScore}/100</TableCell><TableCell><Badge variant="outline">{STATUS_LABELS[item.status]}</Badge></TableCell><TableCell>{item._count.documents}</TableCell><TableCell className="space-x-1 text-right">
        <Button size="sm" variant="ghost" asChild><Link href={`/equipment-disposal/${item.id}`}>Abrir</Link></Button>
        {item.status === 'DRAFT' && role && can(organizationRole(role), 'equipment-disposal.submit') ? <Button size="sm" variant="outline" onClick={() => runCommand(item.id, 'submit')}>Enviar</Button> : null}
        {item.status === 'PENDING_APPROVAL' && role && can(organizationRole(role), 'equipment-disposal.approve') ? <Button size="sm" onClick={() => runCommand(item.id, 'approve')}>Aprobar</Button> : null}
        {item.status === 'PENDING_APPROVAL' && role && can(organizationRole(role), 'equipment-disposal.reject') ? <Button size="sm" variant="outline" onClick={() => runCommand(item.id, 'reject')}>Rechazar</Button> : null}
        {item.status === 'APPROVED' ? <Button size="sm" variant="outline" asChild><a href={`/api/equipment-disposal/${item.id}/pdf`}>PDF</a></Button> : null}
      </TableCell></TableRow>)}
    </TableBody></Table></div></CardContent></Card>
    <Pagination currentPage={page} totalPages={disposals.query.data?.totalPages ?? 1} onPageChange={setPage} />
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Nuevo dictamen técnico</DialogTitle></DialogHeader><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <div className="sm:col-span-2"><Label>Equipo</Label><Select onValueChange={(value) => form.setValue('equipmentId', value, { shouldValidate: true })}><SelectTrigger><SelectValue placeholder="Seleccione un activo" /></SelectTrigger><SelectContent>{equipment.equipment.filter((item) => !['RETIRED', 'LOST', 'DISPOSAL_IN_PROGRESS', 'DISPOSED'].includes(item.status)).map((item) => <SelectItem key={item.id} value={item.id}>{item.inventoryCode} · {item.brand} {item.model}</SelectItem>)}</SelectContent></Select>{form.formState.errors.equipmentId ? <p className="text-sm text-destructive">Seleccione un equipo.</p> : null}</div>
      <Field label="Fecha de compra" error={form.formState.errors.purchaseDate?.message}><Input type="date" {...form.register('purchaseDate')} /></Field><Field label="Precio de compra"><Input type="number" step="0.01" {...form.register('purchasePrice')} /></Field>
      <Field label="Costo estimado de reparación"><Input type="number" step="0.01" {...form.register('estimatedRepairCost')} /></Field><Field label="Precio estimado de reemplazo"><Input type="number" step="0.01" {...form.register('estimatedReplacementPrice')} /></Field>
      <EnumField label="Condición física" value={form.watch('physicalCondition')} values={['EXCELLENT','ACCEPTABLE','FAIR','POOR','CRITICAL']} onChange={(value) => form.setValue('physicalCondition', value as DisposalEvaluationInput['physicalCondition'])} />
      <EnumField label="Condición funcional" value={form.watch('functionalCondition')} values={['OPERATIONAL','SLOW','FREQUENT_FAILURES','INOPERABLE']} onChange={(value) => form.setValue('functionalCondition', value as DisposalEvaluationInput['functionalCondition'])} />
      <EnumField label="Soporte de seguridad" value={form.watch('securitySupportStatus')} values={['SUPPORTED','LIMITED_SUPPORT','UNSUPPORTED','VULNERABLE']} onChange={(value) => form.setValue('securitySupportStatus', value as DisposalEvaluationInput['securitySupportStatus'])} />
      <div className="sm:col-span-2"><Label>Notas técnicas</Label><Textarea rows={5} {...form.register('technicalNotes')} /></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={disposals.create.isPending}>Guardar borrador</Button></div>
    </form></DialogContent></Dialog>
  </div></MainLayout>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div><Label>{label}</Label>{children}{error ? <p className="text-sm text-destructive">{error}</p> : null}</div>; }
function EnumField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{item.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>; }
