'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sileo } from 'sileo';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import {
  oficiosService,
  type OficioNumberingConfigView,
  type OficioSignerView,
} from '@/services/oficios.service';
import {
  OFICIO_DEPENDENCY_LABELS,
  previewNextNumber,
  validateNomenclaturePattern,
  type OficioDependency,
} from '@/lib/oficios-numbering';

const NUMBERING_ROLES = new Set(['ADMIN', 'OWNER', 'IT_MANAGER', 'IT']);
const ELEVATED_ROLES = new Set(['ADMIN', 'OWNER']);

const numberingSchema = z.object({
  dependency: z.enum(['CNI', 'DESPACHO', 'INTERNO']),
  year: z.number().int().min(1990).max(2100),
  nomenclaturePattern: z.string().min(3).max(80),
  lastGeneratedSequence: z.number().int().min(0),
  prefix: z.string().max(40).optional().or(z.literal('')),
  sequencePadding: z.number().int().min(0).max(8).optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
  isActive: z.boolean(),
  reason: z.string().max(300).optional().or(z.literal('')),
  forceSequenceCorrection: z.boolean().optional(),
});

type NumberingFormValues = z.infer<typeof numberingSchema>;

const signerSchema = z.object({
  name: z.string().min(2).max(120),
  positionTitle: z.string().min(2).max(120),
  dependency: z.enum(['CNI', 'DESPACHO', 'ALL']),
  isActive: z.boolean(),
});

type SignerFormValues = z.infer<typeof signerSchema>;

function dependencyLabel(value: string | null) {
  if (!value) return 'Ambas dependencias';
  return OFICIO_DEPENDENCY_LABELS[value as OficioDependency] ?? value;
}

export default function CorrespondenciaSettingsPage() {
  const { user } = useAuth();
  const canConfigure = NUMBERING_ROLES.has(user?.role ?? '');
  const canElevate = ELEVATED_ROLES.has(user?.role ?? '');

  const [configs, setConfigs] = useState<OficioNumberingConfigView[]>([]);
  const [signers, setSigners] = useState<OficioSignerView[]>([]);
  const [loading, setLoading] = useState(true);

  const [numberingOpen, setNumberingOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<OficioNumberingConfigView | null>(null);

  const [signerOpen, setSignerOpen] = useState(false);
  const [editingSigner, setEditingSigner] = useState<OficioSignerView | null>(null);

  const numberingForm = useForm<NumberingFormValues>({
    resolver: zodResolver(numberingSchema),
    defaultValues: {
      dependency: 'CNI',
      year: new Date().getFullYear(),
      nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 0,
      prefix: 'CNI',
      sequencePadding: 0,
      notes: '',
      isActive: true,
      reason: '',
      forceSequenceCorrection: false,
    },
  });

  const signerForm = useForm<SignerFormValues>({
    resolver: zodResolver(signerSchema),
    defaultValues: {
      name: '',
      positionTitle: '',
      dependency: 'ALL',
      isActive: true,
    },
  });

  const watched = numberingForm.watch();
  const livePreview = useMemo(() => {
    const check = validateNomenclaturePattern(watched.nomenclaturePattern || '');
    if (!check.valid) return check.error;
    try {
      return previewNextNumber({
        pattern: watched.nomenclaturePattern,
        lastGeneratedSequence: Number(watched.lastGeneratedSequence || 0),
        year: Number(watched.year || new Date().getFullYear()),
        prefix: watched.prefix,
        sequencePadding: watched.sequencePadding,
      });
    } catch (e) {
      return e instanceof Error ? e.message : 'Patrón inválido';
    }
  }, [watched]);

  const isLowering =
    editingConfig != null &&
    Number(watched.lastGeneratedSequence) < editingConfig.lastGeneratedSequence;

  const load = async () => {
    setLoading(true);
    try {
      const [numberingRes, signersRes] = await Promise.all([
        oficiosService.listNumbering(),
        oficiosService.listSigners({ active: false }),
      ]);
      setConfigs(numberingRes.data.configs);
      setSigners(signersRes.data.signers);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      sileo.error({
        title: 'Sin acceso a configuración',
        description: err.response?.data?.error ?? 'Se requiere permiso oficios.configure',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreateNumbering = (dependency: OficioDependency = 'CNI') => {
    setEditingConfig(null);
    numberingForm.reset({
      dependency,
      year:
        new Date().getFullYear() +
        (configs.some((c) => c.dependency === dependency && c.year === new Date().getFullYear())
          ? 1
          : 0),
      nomenclaturePattern:
        dependency === 'DESPACHO'
          ? 'DPICP-{NUMERO}-{AÑO}'
          : dependency === 'INTERNO'
            ? 'MEMO-{NUMERO}-{AÑO}'
            : 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 0,
      prefix: dependency === 'DESPACHO' ? 'DPICP' : dependency === 'INTERNO' ? 'MEMO' : 'CNI',
      sequencePadding: 0,
      notes: '',
      isActive: true,
      reason: '',
      forceSequenceCorrection: false,
    });
    setNumberingOpen(true);
  };

  const openEditNumbering = (config: OficioNumberingConfigView) => {
    setEditingConfig(config);
    numberingForm.reset({
      dependency: config.dependency as OficioDependency,
      year: config.year,
      nomenclaturePattern: config.nomenclaturePattern,
      lastGeneratedSequence: config.lastGeneratedSequence,
      prefix: config.prefix ?? '',
      sequencePadding: config.sequencePadding,
      notes: config.notes ?? '',
      isActive: config.isActive,
      reason: '',
      forceSequenceCorrection: false,
    });
    setNumberingOpen(true);
  };

  const onSubmitNumbering = async (values: NumberingFormValues) => {
    try {
      await oficiosService.saveNumbering({
        ...values,
        prefix: values.prefix || null,
        notes: values.notes || null,
        forceSequenceCorrection: Boolean(values.forceSequenceCorrection) && canElevate,
        reason: values.reason || undefined,
      });
      sileo.success({
        title: editingConfig ? 'Configuración actualizada' : 'Configuración creada',
      });
      setNumberingOpen(false);
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      sileo.error({
        title: 'No se pudo guardar',
        description: err.response?.data?.error ?? 'Error de validación',
      });
    }
  };

  const openCreateSigner = () => {
    setEditingSigner(null);
    signerForm.reset({
      name: '',
      positionTitle: '',
      dependency: 'ALL',
      isActive: true,
    });
    setSignerOpen(true);
  };

  const openEditSigner = (signer: OficioSignerView) => {
    setEditingSigner(signer);
    signerForm.reset({
      name: signer.name,
      positionTitle: signer.positionTitle,
      dependency: (signer.dependency as 'CNI' | 'DESPACHO') ?? 'ALL',
      isActive: signer.isActive,
    });
    setSignerOpen(true);
  };

  const onSubmitSigner = async (values: SignerFormValues) => {
    try {
      const payload = {
        name: values.name.trim(),
        positionTitle: values.positionTitle.trim(),
        dependency: values.dependency === 'ALL' ? null : values.dependency,
        isActive: values.isActive,
      };
      if (editingSigner) {
        await oficiosService.updateSigner(editingSigner.id, payload);
        sileo.success({ title: 'Firmante actualizado' });
      } else {
        await oficiosService.createSigner(payload);
        sileo.success({ title: 'Firmante creado' });
      }
      setSignerOpen(false);
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      sileo.error({
        title: 'No se pudo guardar el firmante',
        description: err.response?.data?.error ?? 'Error de validación',
      });
    }
  };

  const toggleSignerActive = async (signer: OficioSignerView) => {
    try {
      await oficiosService.updateSigner(signer.id, { isActive: !signer.isActive });
      sileo.success({
        title: signer.isActive ? 'Firmante desactivado' : 'Firmante activado',
      });
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      sileo.error({
        title: 'No se pudo cambiar el estado',
        description: err.response?.data?.error ?? 'Error',
      });
    }
  };

  if (!canConfigure && !loading && configs.length === 0) {
    return (
      <MainLayout>
        <PageHeader title="Correspondencia" description="Numeración y firmantes" />
        <Card className="p-6">
          <p className="text-muted-foreground">
            Solo perfiles técnicos autorizados (Admin / TI) pueden configurar correspondencia.
          </p>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 max-w-4xl">
        <PageHeader
          title="Correspondencia"
          description="Numeración institucional y firmantes autorizados"
        />

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Numeración de oficios</h2>
              <p className="text-sm text-muted-foreground">
                Correlativos por dependencia y año
              </p>
            </div>
            <Button onClick={() => openCreateNumbering('CNI')}>
              Crear configuración para nuevo año
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : (
            <div className="grid gap-4">
              {configs.map((config) => (
                <Card key={config.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle>
                        {OFICIO_DEPENDENCY_LABELS[config.dependency as OficioDependency] ??
                          config.dependency}{' '}
                        — {config.year}
                      </CardTitle>
                      <CardDescription>Pattern: {config.nomenclaturePattern}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEditNumbering(config)}>
                      Editar
                    </Button>
                  </CardHeader>
                  <CardContent className="grid gap-1 text-sm sm:grid-cols-3">
                    <div>
                      Último: <strong>{config.lastGeneratedSequence}</strong>
                    </div>
                    <div>
                      Próximo: <strong>{config.nextNumber}</strong>
                    </div>
                    <div>
                      Estado: <strong>{config.isActive ? 'Activa' : 'Inactiva'}</strong>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Firmantes autorizados</h2>
              <p className="text-sm text-muted-foreground">
                Catálogo de firmantes para correspondencia de salida
              </p>
            </div>
            <Button onClick={openCreateSigner}>Crear firmante</Button>
          </div>

          <Card>
            {signers.length === 0 ? (
              <CardContent className="py-8 text-sm text-muted-foreground">
                No hay firmantes registrados.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Dependencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signers.map((signer) => (
                    <TableRow key={signer.id}>
                      <TableCell className="font-medium">{signer.name}</TableCell>
                      <TableCell>{signer.positionTitle}</TableCell>
                      <TableCell>{dependencyLabel(signer.dependency)}</TableCell>
                      <TableCell>
                        <Badge variant={signer.isActive ? 'default' : 'secondary'}>
                          {signer.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSigner(signer)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void toggleSignerActive(signer)}
                        >
                          {signer.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>

        <Dialog open={numberingOpen} onOpenChange={setNumberingOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? 'Editar numeración' : 'Nueva configuración de numeración'}
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={numberingForm.handleSubmit(onSubmitNumbering)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Dependencia</Label>
                  <Select
                    value={numberingForm.watch('dependency')}
                    onValueChange={(v) =>
                      numberingForm.setValue('dependency', v as OficioDependency)
                    }
                    disabled={!!editingConfig}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNI">CNI</SelectItem>
                      <SelectItem value="DESPACHO">Despacho</SelectItem>
                      <SelectItem value="INTERNO">Internos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Año</Label>
                  <Input
                    type="number"
                    {...numberingForm.register('year', { valueAsNumber: true })}
                    disabled={!!editingConfig}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Patrón de nomenclatura</Label>
                <Input
                  {...numberingForm.register('nomenclaturePattern')}
                  placeholder="CNI-{NUMERO}-{AÑO}"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Último correlativo</Label>
                  <Input
                    type="number"
                    {...numberingForm.register('lastGeneratedSequence', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prefijo</Label>
                  <Input {...numberingForm.register('prefix')} />
                </div>
                <div className="space-y-2">
                  <Label>Padding</Label>
                  <Input
                    type="number"
                    {...numberingForm.register('sequencePadding', { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                Vista previa próximo: <strong>{livePreview}</strong>
              </div>
              {isLowering ? (
                <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p className="text-amber-950">
                    Está intentando bajar el correlativo. Por defecto no se permite.
                  </p>
                  {canElevate ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(numberingForm.watch('forceSequenceCorrection'))}
                          onCheckedChange={(v) =>
                            numberingForm.setValue('forceSequenceCorrection', v)
                          }
                        />
                        <Label>Corrección elevada (solo Admin)</Label>
                      </div>
                      <Input
                        {...numberingForm.register('reason')}
                        placeholder="Motivo obligatorio de la corrección"
                      />
                    </>
                  ) : (
                    <p className="text-amber-950">
                      Un administrador debe aplicar una corrección elevada con motivo.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Motivo del ajuste (si aplica)</Label>
                  <Input {...numberingForm.register('reason')} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={numberingForm.watch('isActive')}
                  onCheckedChange={(v) => numberingForm.setValue('isActive', v)}
                />
                <Label>Configuración activa</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNumberingOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={signerOpen} onOpenChange={setSignerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSigner ? 'Editar firmante' : 'Crear firmante'}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={signerForm.handleSubmit(onSubmitSigner)}>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input {...signerForm.register('name')} />
              </div>
              <div className="space-y-2">
                <Label>Cargo / posición</Label>
                <Input {...signerForm.register('positionTitle')} />
              </div>
              <div className="space-y-2">
                <Label>Dependencia</Label>
                <Select
                  value={signerForm.watch('dependency')}
                  onValueChange={(v) =>
                    signerForm.setValue('dependency', v as SignerFormValues['dependency'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Ambas dependencias</SelectItem>
                    <SelectItem value="CNI">CNI</SelectItem>
                    <SelectItem value="DESPACHO">Despacho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={signerForm.watch('isActive')}
                  onCheckedChange={(v) => signerForm.setValue('isActive', v)}
                />
                <Label>Activo</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSignerOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
