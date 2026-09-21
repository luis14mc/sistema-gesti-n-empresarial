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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { oficiosService, type OficioNumberingConfigView } from '@/services/oficios.service';
import {
  OFICIO_DEPENDENCY_LABELS,
  previewNextNumber,
  validateNomenclaturePattern,
  type OficioDependency,
} from '@/lib/oficios-numbering';

const NUMBERING_ROLES = new Set(['ADMIN', 'OWNER', 'IT_MANAGER', 'IT']);

const schema = z.object({
  dependency: z.enum(['CNI', 'DESPACHO', 'INTERNO']),
  year: z.number().int().min(1990).max(2100),
  nomenclaturePattern: z.string().min(3).max(80),
  lastGeneratedSequence: z.number().int().min(0),
  prefix: z.string().max(40).optional().or(z.literal('')),
  sequencePadding: z.number().int().min(0).max(8).optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
  isActive: z.boolean(),
  reason: z.string().max(300).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function CorrespondenciaSettingsPage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<OficioNumberingConfigView[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OficioNumberingConfigView | null>(null);

  const canConfigure = NUMBERING_ROLES.has(user?.role ?? '');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
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
    },
  });

  const watched = form.watch();
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

  const load = async () => {
    setLoading(true);
    try {
      const res = await oficiosService.listNumbering();
      setConfigs(res.data.configs);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      sileo.error({
        title: 'Sin acceso a numeración',
        description: err.response?.data?.error ?? 'Se requiere permiso oficios.configure',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = (dependency: OficioDependency = 'CNI') => {
    setEditing(null);
    form.reset({
      dependency,
      year: new Date().getFullYear() + (configs.some((c) => c.dependency === dependency && c.year === new Date().getFullYear()) ? 1 : 0),
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
    });
    setDialogOpen(true);
  };

  const openEdit = (config: OficioNumberingConfigView) => {
    setEditing(config);
    form.reset({
      dependency: config.dependency as OficioDependency,
      year: config.year,
      nomenclaturePattern: config.nomenclaturePattern,
      lastGeneratedSequence: config.lastGeneratedSequence,
      prefix: config.prefix ?? '',
      sequencePadding: config.sequencePadding,
      notes: config.notes ?? '',
      isActive: config.isActive,
      reason: '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await oficiosService.saveNumbering({
        ...values,
        prefix: values.prefix || null,
        notes: values.notes || null,
      });
      sileo.success({ title: editing ? 'Configuración actualizada' : 'Configuración creada' });
      setDialogOpen(false);
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      sileo.error({
        title: 'No se pudo guardar',
        description: err.response?.data?.error ?? 'Error de validación',
      });
    }
  };

  if (!canConfigure && !loading && configs.length === 0) {
    return (
      <MainLayout>
        <PageHeader title="Correspondencia" description="Numeración de oficios" />
        <Card className="p-6">
          <p className="text-muted-foreground">
            Solo perfiles técnicos autorizados (Admin / TI) pueden configurar la numeración.
          </p>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title="Correspondencia"
          description="Numeración institucional de oficios por dependencia y año"
        >
          <Button onClick={() => openCreate('CNI')}>Crear configuración para nuevo año</Button>
        </PageHeader>

        {loading ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : (
          <div className="grid gap-4">
            {configs.map((config) => (
              <Card key={config.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>
                      {OFICIO_DEPENDENCY_LABELS[config.dependency as OficioDependency] ?? config.dependency}{' '}
                      — {config.year}
                    </CardTitle>
                    <CardDescription>
                      Pattern: {config.nomenclaturePattern}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(config)}>
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
                    Estado:{' '}
                    <strong>{config.isActive ? 'Activa' : 'Inactiva'}</strong>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? 'Editar numeración' : 'Nueva configuración de numeración'}
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Dependencia</Label>
                  <Select
                    value={form.watch('dependency')}
                    onValueChange={(v) => form.setValue('dependency', v as OficioDependency)}
                    disabled={!!editing}
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
                    {...form.register('year', { valueAsNumber: true })}
                    disabled={!!editing}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Patrón de nomenclatura</Label>
                <Input {...form.register('nomenclaturePattern')} placeholder="CNI-{NUMERO}-{AÑO}" />
                <p className="text-xs text-muted-foreground">
                  Marcadores: {'{NUMERO}'}, {'{AÑO}'}, {'{PREFIJO}'}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Último correlativo</Label>
                  <Input type="number" {...form.register('lastGeneratedSequence', { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Prefijo</Label>
                  <Input {...form.register('prefix')} />
                </div>
                <div className="space-y-2">
                  <Label>Padding</Label>
                  <Input type="number" {...form.register('sequencePadding', { valueAsNumber: true })} />
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                Vista previa próximo: <strong>{livePreview}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch('isActive')}
                  onCheckedChange={(v) => form.setValue('isActive', v)}
                />
                <Label>Configuración activa</Label>
              </div>
              <div className="space-y-2">
                <Label>Motivo del ajuste (si aplica)</Label>
                <Input {...form.register('reason')} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
