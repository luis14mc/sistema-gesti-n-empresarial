'use client';

import { use } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEquipmentDisposal } from '@/hooks/useEquipmentDisposals';
import { DisposalPreviewClient } from '@/modules/equipment-disposal/presentation/components/DisposalPreviewClient';
import type { DisposalDocumentData } from '@/modules/equipment-disposal/presentation/components/DisposalDocument';
import { swalConfirm, swalError, swalSuccess } from '@/lib/swal';
import { getApiErrorMessage } from '@/lib/api-error';

const money = (value: string) => `L ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EquipmentDisposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { organization, query, upload, remove } = useEquipmentDisposal(id);
  const disposal = query.data;
  if (query.isLoading || !disposal) return <MainLayout><div className="p-8">Cargando dictamen...</div></MainLayout>;
  const data: DisposalDocumentData = {
    folio: disposal.folio, statusLabel: disposal.status === 'APPROVED' ? 'APROBADO' : 'BORRADOR', institutionName: organization.data?.organization.name ?? 'Consejo Nacional de Inversiones',
    inventoryCode: disposal.equipment.inventoryCode, serialNumber: disposal.serialNumber, equipmentDescription: `${disposal.brand} ${disposal.model}`,
    department: disposal.department, custodianName: disposal.custodianName, purchaseDate: new Date(disposal.purchaseDate).toLocaleDateString('es-HN'),
    purchasePrice: money(disposal.purchasePrice), estimatedRepairCost: money(disposal.estimatedRepairCost), estimatedReplacementPrice: money(disposal.estimatedReplacementPrice),
    physicalCondition: disposal.physicalCondition, functionalCondition: disposal.functionalCondition, securitySupportStatus: disposal.securitySupportStatus,
    technicalNotes: disposal.technicalNotes, evaluationScore: disposal.evaluationScore, disposalResult: disposal.disposalResult,
    rationales: disposal.evaluationRationales?.rationales ?? [], signatureTitle: 'APROBACIÓN INSTITUCIONAL',
  };
  const deleteDocument = async (documentId: string) => {
    const confirmation = await swalConfirm('¿Eliminar evidencia?', 'Esta acción no se puede deshacer.', 'Eliminar');
    if (!confirmation.isConfirmed) return;
    try { await remove.mutateAsync(documentId); await swalSuccess('Evidencia eliminada'); } catch (error) { await swalError('No se pudo eliminar', getApiErrorMessage(error, 'Intente nuevamente.')); }
  };
  return <MainLayout><div className="space-y-6"><PageHeader title={disposal.folio} description={`${disposal.brand} ${disposal.model}`}><Button variant="outline" asChild><Link href="/equipment-disposal">Volver</Link></Button>{disposal.status === 'APPROVED' ? <Button asChild><a href={`/api/equipment-disposal/${id}/pdf`}>Descargar PDF</a></Button> : null}</PageHeader>
    <Tabs defaultValue="asset"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="asset">Datos del activo</TabsTrigger><TabsTrigger value="evaluation">Evaluación técnica</TabsTrigger><TabsTrigger value="result">Resultado automático</TabsTrigger><TabsTrigger value="evidence">Evidencias</TabsTrigger><TabsTrigger value="preview">Vista previa</TabsTrigger><TabsTrigger value="history">Historial</TabsTrigger></TabsList>
      <TabsContent value="asset"><Card><CardContent className="grid gap-4 pt-6 sm:grid-cols-2"><Info label="Inventario" value={disposal.equipment.inventoryCode} /><Info label="Serie" value={disposal.serialNumber} /><Info label="Equipo" value={`${disposal.brand} ${disposal.model}`} /><Info label="Departamento" value={disposal.department} /></CardContent></Card></TabsContent>
      <TabsContent value="evaluation"><Card><CardContent className="grid gap-4 pt-6 sm:grid-cols-2"><Info label="Condición física" value={disposal.physicalCondition} /><Info label="Condición funcional" value={disposal.functionalCondition} /><Info label="Soporte de seguridad" value={disposal.securitySupportStatus} /><Info label="Costo de reparación" value={money(disposal.estimatedRepairCost)} /><div className="sm:col-span-2"><Info label="Notas técnicas" value={disposal.technicalNotes || 'Sin notas'} /></div></CardContent></Card></TabsContent>
      <TabsContent value="result"><Card><CardContent className="pt-6"><p className="text-4xl font-bold text-primary">{disposal.evaluationScore}/100</p><p className="mt-2 font-semibold">{disposal.disposalResult}</p><ul className="mt-4 list-disc pl-5">{data.rationales.map((item) => <li key={item}>{item}</li>)}</ul></CardContent></Card></TabsContent>
      <TabsContent value="evidence"><Card><CardContent className="space-y-4 pt-6">{disposal.status === 'DRAFT' || disposal.status === 'PENDING_APPROVAL' ? <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await upload.mutateAsync(file); await swalSuccess('Evidencia cargada'); } catch (error) { await swalError('No se pudo cargar', getApiErrorMessage(error, 'Revise el archivo.')); } }} /> : null}{disposal.documents.length === 0 ? <p className="text-muted-foreground">No hay evidencias adjuntas.</p> : disposal.documents.map((document) => <div key={document.id} className="flex items-center justify-between rounded-lg border p-3"><a className="font-medium text-primary hover:underline" href={`/api/equipment-disposal/${id}/documents/${document.id}/view`} target="_blank" rel="noreferrer">{document.originalName}</a>{disposal.status === 'DRAFT' ? <Button size="sm" variant="destructive" onClick={() => deleteDocument(document.id)}>Eliminar</Button> : null}</div>)}</CardContent></Card></TabsContent>
      <TabsContent value="preview"><DisposalPreviewClient data={data} draft={disposal.status !== 'APPROVED'} /></TabsContent>
      <TabsContent value="history"><Card><CardContent className="space-y-3 pt-6">{disposal.history.map((event) => <div key={event.id} className="border-l-2 border-primary pl-4"><p className="font-medium">{event.action.replaceAll('_', ' ')}</p><p className="text-sm text-muted-foreground">{new Date(event.createdAt).toLocaleString('es-HN')}</p></div>)}</CardContent></Card></TabsContent>
    </Tabs></div></MainLayout>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><p>{value}</p></div>; }
