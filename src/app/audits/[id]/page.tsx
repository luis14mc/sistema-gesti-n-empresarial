'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    CheckCircle,
    XCircle,
    AlertCircle,
    MinusCircle,
    Plus,
    ChevronLeft,
    Calendar,
    User,
    MapPin,
    MessageSquare,
    FileText,
    Save,
    Trash2
} from 'lucide-react';
import { useAuditDetail } from '@/hooks/useAudits';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/lib/permissions';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const statusColors: Record<string, string> = {
    PLANNED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
};

const resultIcons: Record<string, any> = {
    CONFORMING: <CheckCircle className="h-4 w-4 text-green-600" />,
    NON_CONFORMING: <XCircle className="h-4 w-4 text-red-600" />,
    OBSERVATION: <AlertCircle className="h-4 w-4 text-amber-600" />,
    NOT_APPLICABLE: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};

const severityColors: Record<string, string> = {
    STRENGTH: 'bg-emerald-100 text-emerald-700',
    CONFORMITY: 'bg-green-100 text-green-700',
    OBSERVATION: 'bg-amber-100 text-amber-700',
    MINOR_NC: 'bg-red-100 text-red-700',
    MAJOR_NC: 'bg-red-200 text-red-800 font-bold border-red-300',
};

export default function AuditDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { user } = useAuth();
    const {
        audit,
        isLoading,
        updateAudit,
        isUpdating,
        deleteAudit,
        addFinding,
        isAddingFinding,
        addChecklistItem,
        isAddingChecklistItem,
        updateChecklistResult
    } = useAuditDetail(id);

    const [activeTab, setActiveTab] = useState('summary');
    const [findingDialogOpen, setFindingDialogOpen] = useState(false);
    const [itemDialogOpen, setItemDialogOpen] = useState(false);

    const canEdit = canAccess(user?.role as any, 'audit-records' as any, 'update');
    const isAdmin = user?.role === 'ADMIN';

    if (isLoading) return <AuditSkeleton />;
    if (!audit) return <div className="p-20 text-center">Auditoría no encontrada.</div>;

    const handleDelete = async () => {
        const confirm = await swalConfirm('¿Eliminar auditoría?', 'Esta acción no se puede deshacer.', 'Eliminar');
        if (confirm.isConfirmed) {
            try {
                await deleteAudit();
                sileo.success({ title: 'Audit eliminada' });
                router.push('/audits');
            } catch (error) {
                sileo.error({ title: 'Error' });
            }
        }
    };

    const handleCreateFinding = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
            await addFinding({
                description: fd.get('description') as string,
                evidence: fd.get('evidence') as string,
                severity: fd.get('severity') as any,
                clause: fd.get('clause') as string,
            });
            setFindingDialogOpen(false);
            sileo.success({ title: 'Hallazgo registrado' });
        } catch (error) {
            sileo.error({ title: 'Error al registrar' });
        }
    };

    const handleCreateItem = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
            await addChecklistItem({
                requirement: fd.get('requirement') as string,
                clause: fd.get('clause') as string,
                sortOrder: parseInt(fd.get('sortOrder') as string) || 0,
            });
            setItemDialogOpen(false);
            sileo.success({ title: 'Item agregado' });
        } catch (error) {
            sileo.error({ title: 'Error al agregar' });
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            const updateData: any = { status: newStatus };
            if (newStatus === 'IN_PROGRESS' && !audit.startDate) updateData.startDate = new Date().toISOString();
            if (newStatus === 'COMPLETED' && !audit.endDate) updateData.endDate = new Date().toISOString();

            await updateAudit(updateData);
            sileo.success({ title: 'Estado actualizado' });
        } catch (error) {
            sileo.error({ title: 'Error' });
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link href="/audits" className="hover:text-foreground flex items-center gap-1 transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Volver a lista
                    </Link>
                </div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{audit.code}</span>
                            <Badge variant="outline" className={statusColors[audit.status]}>
                                {audit.status}
                            </Badge>
                        </div>
                        <h1 className="text-3xl font-heading font-bold">{audit.title}</h1>
                        <p className="text-muted-foreground">{audit.standard}</p>
                    </div>

                    <div className="flex gap-2">
                        {canEdit && audit.status === 'PLANNED' && (
                            <Button onClick={() => handleStatusChange('IN_PROGRESS')}>Iniciar Auditoría</Button>
                        )}
                        {canEdit && audit.status === 'IN_PROGRESS' && (
                            <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange('COMPLETED')}>
                                Finalizar Auditoría
                            </Button>
                        )}
                        {isAdmin && (
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                                <Trash2 className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-4">
                        <TabsTrigger value="summary">Resumen</TabsTrigger>
                        <TabsTrigger value="checklist">Checklist</TabsTrigger>
                        <TabsTrigger value="findings">Hallazgos</TabsTrigger>
                        <TabsTrigger value="conclusions">Cierre</TabsTrigger>
                    </TabsList>

                    {/* SUMMARY TAB */}
                    <TabsContent value="summary" className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="md:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-lg">Información General</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <InfoItem icon={<Calendar className="h-4 w-4" />} label="Fecha Programada" value={audit.plannedDate ? format(new Date(audit.plannedDate), 'PPP', { locale: es }) : '—'} />
                                        <InfoItem icon={<User className="h-4 w-4" />} label="Auditor Líder" value={`${audit.leadAuditor?.firstName} ${audit.leadAuditor?.lastName}`} />
                                        <InfoItem icon={<MapPin className="h-4 w-4" />} label="Departamento" value={audit.department || 'No especificado'} />
                                        <InfoItem icon={<Calendar className="h-4 w-4" />} label="Inicio Real" value={audit.startDate ? format(new Date(audit.startDate), 'PPP p', { locale: es }) : '—'} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2">Alcance</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed italic">{audit.scope}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2">Objetivos</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{audit.objectives}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold mb-2">Criterios de Auditoría</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{audit.criteria}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <Card>
                                    <CardHeader><CardTitle className="text-sm">Estadísticas</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Items Checklist</span>
                                            <span className="font-bold">{audit.checklist?.length || 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Hallazgos Registrados</span>
                                            <span className="font-bold text-amber-600">{audit.findings?.length || 0}</span>
                                        </div>
                                        <div className="pt-2 border-t">
                                            <div className="flex justify-between items-center text-xs mb-1">
                                                <span>Progreso Checklist</span>
                                                <span>{Math.round(((audit.checklist?.filter(i => i.result !== 'NOT_APPLICABLE')?.length || 0) / (audit.checklist?.length || 1)) * 100)}%</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="bg-primary h-full transition-all"
                                                    style={{ width: `${Math.round(((audit.checklist?.filter(i => i.result !== 'NOT_APPLICABLE')?.length || 0) / (audit.checklist?.length || 1)) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {audit.auditeeContact && (
                                    <Card>
                                        <CardHeader><CardTitle className="text-sm">Contacto Auditado</CardTitle></CardHeader>
                                        <CardContent>
                                            <p className="text-sm">{audit.auditeeContact}</p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* CHECKLIST TAB */}
                    <TabsContent value="checklist" className="space-y-4 pt-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg">Checklist de Cumplimiento</CardTitle>
                                <CardDescription>Evaluación de requisitos de la norma.</CardDescription>
                            </div>
                            {canEdit && audit.status !== 'COMPLETED' && (
                                <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Agregar Punto</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Nuevo Punto de Control</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateItem} className="space-y-4">
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className="col-span-1">
                                                    <Label>Cláusula</Label>
                                                    <Input name="clause" placeholder="Ej: 4.1" />
                                                </div>
                                                <div className="col-span-3">
                                                    <Label>Orden</Label>
                                                    <Input name="sortOrder" type="number" defaultValue={(audit.checklist?.length || 0) + 1} />
                                                </div>
                                            </div>
                                            <div>
                                                <Label>Requerimiento / Pregunta</Label>
                                                <Textarea name="requirement" placeholder="Describe el cumplimiento a verificar..." required />
                                            </div>
                                            <DialogFooter>
                                                <Button type="submit">Agregar al Checklist</Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>

                        {(!audit.checklist || audit.checklist.length === 0) ? (
                            <Card><CardContent className="py-12 text-center text-muted-foreground italic">No hay items en el checklist.</CardContent></Card>
                        ) : (
                            <div className="space-y-3">
                                {audit.checklist.map((item) => (
                                    <ChecklistItemView
                                        key={item.id}
                                        item={item}
                                        canEdit={canEdit && audit.status !== 'COMPLETED'}
                                        onUpdate={(res, notes, ev) => updateChecklistResult({ itemId: item.id, data: { result: res, notes, evidence: ev } })}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* FINDINGS TAB */}
                    <TabsContent value="findings" className="space-y-4 pt-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-lg">Hallazgos de Auditoría</CardTitle>
                                <CardDescription>No conformidades, observaciones y fortalezas detectadas.</CardDescription>
                            </div>
                            {canEdit && audit.status !== 'COMPLETED' && (
                                <Dialog open={findingDialogOpen} onOpenChange={setFindingDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" /> Registrar Hallazgo</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader><DialogTitle>Nuevo Hallazgo</DialogTitle></DialogHeader>
                                        <form onSubmit={handleCreateFinding} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Tipo / Severidad</Label>
                                                    <Select name="severity" defaultValue="MINOR_NC">
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="STRENGTH">Fortaleza</SelectItem>
                                                            <SelectItem value="CONFORMITY">Conformidad</SelectItem>
                                                            <SelectItem value="OBSERVATION">Observación</SelectItem>
                                                            <SelectItem value="MINOR_NC">No Conformidad Menor</SelectItem>
                                                            <SelectItem value="MAJOR_NC">No Conformidad Mayor</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Cláusula Referencia</Label>
                                                    <Input name="clause" placeholder="Ej: 7.5.1" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Descripción del Hallazgo</Label>
                                                <Textarea name="description" placeholder="Detalle lo observado..." required rows={3} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Evidencia Objetiva</Label>
                                                <Textarea name="evidence" placeholder="Registros, documentos, entrevistas..." required />
                                            </div>
                                            <DialogFooter>
                                                <Button type="submit">Registrar Hallazgo</Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>

                        {(!audit.findings || audit.findings.length === 0) ? (
                            <Card><CardContent className="py-12 text-center text-muted-foreground italic">No se han registrado hallazgos aún.</CardContent></Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {audit.findings.map(finding => (
                                    <Card key={finding.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: 'rgb(var(--primary))' }}>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <Badge className={severityColors[finding.severity]}>{finding.severity}</Badge>
                                                <span className="font-mono text-[10px] text-muted-foreground">{finding.code}</span>
                                            </div>
                                            <CardTitle className="text-sm mt-2">{finding.clause && `[Cláusula ${finding.clause}] `}{finding.description.substring(0, 100)}{finding.description.length > 100 ? '...' : ''}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="bg-muted/30 rounded p-2 text-xs">
                                                <p className="font-semibold mb-1">Evidencia:</p>
                                                <p className="text-muted-foreground italic">{finding.evidence}</p>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-muted-foreground top-2 border-t pt-2">
                                                <span>Estado: <Badge variant="outline" className="text-[10px]">{finding.status}</Badge></span>
                                                <span>{format(new Date(finding.createdAt), 'dd/MM/yyyy')}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* CONCLUSIONS TAB */}
                    <TabsContent value="conclusions" className="space-y-4 pt-4">
                        <Card>
                            <CardHeader><CardTitle>Conclusiones y Recomendaciones</CardTitle></CardHeader>
                            <CardContent>
                                {canEdit && audit.status !== 'COMPLETED' ? (
                                    <form className="space-y-6" onSubmit={(e) => {
                                        e.preventDefault();
                                        const fd = new FormData(e.currentTarget);
                                        updateAudit({
                                            conclusions: fd.get('conclusions') as string,
                                            recommendations: fd.get('recommendations') as string,
                                        }).then(() => sileo.success({ title: 'Cierre guardado' }));
                                    }}>
                                        <div className="space-y-2">
                                            <Label>Conclusiones de la Auditoría</Label>
                                            <Textarea name="conclusions" defaultValue={audit.conclusions || ''} rows={4} placeholder="Resumen del desempeño del sistema..." />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Recomendaciones</Label>
                                            <Textarea name="recommendations" defaultValue={audit.recommendations || ''} rows={4} placeholder="Sugerencias de mejora..." />
                                        </div>
                                        <Button type="submit"><Save className="h-4 w-4 mr-2" /> Guardar Informe de Cierre</Button>
                                    </form>
                                ) : (
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="font-semibold mb-2">Conclusiones</h4>
                                            <p className="text-sm text-muted-foreground bg-muted/20 p-4 rounded-lg">{audit.conclusions || 'Pendiente de redactar'}</p>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold mb-2">Recomendaciones</h4>
                                            <p className="text-sm text-muted-foreground bg-muted/20 p-4 rounded-lg">{audit.recommendations || 'Sin recomendaciones'}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 text-primary">{icon}</div>
            <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">{label}</p>
                <p className="text-sm font-medium">{value}</p>
            </div>
        </div>
    );
}

function ChecklistItemView({ item, canEdit, onUpdate }: { item: any, canEdit: boolean, onUpdate: (res: any, notes: string, ev: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ result: item.result, notes: item.notes || '', evidence: item.evidence || '' });

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="shrink-0 pt-1">
                        {resultIcons[item.result || 'NOT_APPLICABLE']}
                    </div>
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                            {item.clause && <Badge variant="outline" className="text-[10px] h-4 bg-muted/50">{item.clause}</Badge>}
                            <span className="text-sm font-medium leading-tight">{item.requirement}</span>
                        </div>
                        {(item.notes || item.evidence) && !editing && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                {item.notes && (
                                    <div className="text-[11px] bg-muted/40 p-2 rounded flex gap-2">
                                        <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 opacity-50" />
                                        <span>{item.notes}</span>
                                    </div>
                                )}
                                {item.evidence && (
                                    <div className="text-[11px] bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded border border-blue-100 dark:border-blue-900/30 flex gap-2">
                                        <FileText className="h-3 w-3 shrink-0 mt-0.5 opacity-50" />
                                        <span>{item.evidence}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {editing && (
                            <div className="space-y-3 mt-4 bg-muted/20 p-3 rounded-lg border">
                                <div className="flex flex-wrap gap-2">
                                    {['CONFORMING', 'NON_CONFORMING', 'OBSERVATION', 'NOT_APPLICABLE'].map(r => (
                                        <Button
                                            key={r}
                                            type="button"
                                            variant={form.result === r ? 'default' : 'outline'}
                                            size="sm"
                                            className="text-[10px] h-7"
                                            onClick={() => setForm(f => ({ ...f, result: r }))}
                                        >
                                            {r.replace('_', ' ')}
                                        </Button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Notas / Observaciones</Label>
                                        <Textarea className="text-xs min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Evidencia Objetiva</Label>
                                        <Textarea className="text-xs min-h-[60px]" value={form.evidence} onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                                    <Button size="sm" onClick={() => { onUpdate(form.result, form.notes, form.evidence); setEditing(false); }}>Guardar</Button>
                                </div>
                            </div>
                        )}
                    </div>
                    {canEdit && !editing && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Evaluar</Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function AuditSkeleton() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <Skeleton className="h-6 w-32" />
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-64" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="md:col-span-2 h-[400px]" />
                    <Skeleton className="h-[400px]" />
                </div>
            </div>
        </MainLayout>
    );
}
