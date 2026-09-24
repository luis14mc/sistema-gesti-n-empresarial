'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useForm, useWatch, type UseFormRegister, type FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Swal from '@/lib/compras/orden/swal';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { compraOrdenService } from '@/services/compra-orden.service';
import { ordenKeys } from '@/hooks/useCompraOrden';
import { purchaseOrderTemplateSchema, type PurchaseOrderTemplateInput } from '@/lib/compras/orden/schemas';
import { comprasService } from '@/services/compras.service';
import { cn } from '@/lib/utils';

const VISIBILITY_FIELDS = [
  ['showInstitutionAddress', 'Dirección'],
  ['showInstitutionPhone', 'Teléfono'],
  ['showInstitutionWebsite', 'Sitio web'],
  ['showInstitutionRtn', 'RTN'],
  ['showReference', 'Referencia'],
  ['showRequiredDate', 'Fecha requerida'],
] as const;

const DEFAULTS: PurchaseOrderTemplateInput = {
  name: 'Plantilla CNI',
  institutionName: 'Consejo Nacional de Inversiones',
  documentTitle: 'ORDEN DE COMPRA',
  orderPrefix: 'COM-CNI',
  signatureTitle: 'ÁREA ADMINISTRATIVA',
  primaryColor: '#334E88',
  secondaryColor: '#32B372',
  showInstitutionAddress: true,
  showInstitutionPhone: true,
  showInstitutionWebsite: true,
  showInstitutionRtn: false,
  showReference: true,
  showRequiredDate: true,
};

function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error.message}</p> : null}
    </div>
  );
}

function ColorField({
  label,
  name,
  value,
  register,
  error,
  onPick,
}: {
  label: string;
  name: 'primaryColor' | 'secondaryColor';
  value: string;
  register: UseFormRegister<PurchaseOrderTemplateInput>;
  error?: FieldError;
  onPick: (hex: string) => void;
}) {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#334E88';
  return (
    <Field label={label} htmlFor={name} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Elegir ${label.toLowerCase()}`}
          value={safe}
          onChange={(event) => onPick(event.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <Input id={name} {...register(name)} spellCheck={false} className="font-mono uppercase" />
      </div>
    </Field>
  );
}

function HeaderPreview({ values }: { values: PurchaseOrderTemplateInput }) {
  const meta = [
    values.showInstitutionAddress ? values.institutionAddress : null,
    values.showInstitutionPhone && values.institutionPhone ? `Tel. ${values.institutionPhone}` : null,
    values.showInstitutionWebsite ? values.institutionWebsite : null,
    values.showInstitutionRtn && values.institutionRtn ? `RTN ${values.institutionRtn}` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="overflow-hidden rounded-lg border bg-white text-[#172033] shadow-xs">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b-[3px] px-3 py-3" style={{ borderColor: values.primaryColor }}>
        {values.logoUrl ? (
          <img src={values.logoUrl} alt="" className="h-12 w-12 object-contain" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded bg-slate-100 text-[10px] text-slate-400">Logo</div>
        )}
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-bold" style={{ color: values.primaryColor }}>{values.institutionName || 'Institución'}</p>
          {meta.map((line) => (
            <p key={line} className="truncate text-[10px] text-slate-500">{line}</p>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]">
        <span className="font-semibold uppercase tracking-wide" style={{ color: values.primaryColor }}>{values.documentTitle || 'Documento'}</span>
        <span className="font-mono text-slate-500">{values.orderPrefix || 'PRE'}-0001</span>
      </div>
      <div className="grid grid-cols-2 border-t text-[10px]">
        <div className="border-r px-3 py-2">
          <p className="font-semibold uppercase text-slate-400">Referencia</p>
          <p>{values.showReference ? 'OC-2026-014' : '—'}</p>
        </div>
        <div className="px-3 py-2">
          <p className="font-semibold uppercase text-slate-400">Fecha requerida</p>
          <p>{values.showRequiredDate ? '24/09/2026' : '—'}</p>
        </div>
      </div>
      <div className="px-3 py-2 text-[10px]" style={{ background: values.primaryColor, borderLeft: `4px solid ${values.secondaryColor}` }}>
        <p className="font-semibold uppercase text-white">Datos del solicitante</p>
      </div>
    </div>
  );
}

export default function ComprasTemplateSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const form = useForm<PurchaseOrderTemplateInput>({
    resolver: zodResolver(purchaseOrderTemplateSchema),
    defaultValues: DEFAULTS,
  });
  const values = useWatch({ control: form.control }) as PurchaseOrderTemplateInput;
  const errors = form.formState.errors;

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/settings');
  }, [user, router]);

  useEffect(() => {
    let active = true;
    compraOrdenService.getTemplate()
      .then(({ data }) => {
        if (!active) return;
        const template = data.template as PurchaseOrderTemplateInput | null;
        if (template) form.reset(template);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [form]);

  if (!user || user.role !== 'ADMIN') return null;

  const onSubmit = async (data: PurchaseOrderTemplateInput) => {
    try {
      await compraOrdenService.saveTemplate(data);
      await queryClient.invalidateQueries({ queryKey: ordenKeys.activeTemplate() });
      await queryClient.refetchQueries({ queryKey: ordenKeys.activeTemplate() });
      await Swal.fire({ icon: 'success', title: 'Formato guardado', text: 'Se creó una nueva versión activa.', confirmButtonText: 'Aceptar' });
    } catch {
      await Swal.fire({ icon: 'error', title: 'Error al guardar el formato', confirmButtonText: 'Cerrar' });
    }
  };

  return (
    <MainLayout>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageHeader
          title="Plantilla de orden de compra"
          description="Encabezado, colores y datos que aparecen en el documento. Guardar crea una versión nueva."
          breadcrumbs={[
            { label: 'Ajustes', href: '/settings' },
            { label: 'Plantilla de compra' },
          ]}
          primaryAction={(
            <Button type="submit" disabled={!ready || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Guardando…' : 'Guardar plantilla'}
            </Button>
          )}
        />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Institución</CardTitle>
                <CardDescription>Datos del encabezado. Cada interruptor de la derecha decide si se imprime.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="institutionName" error={errors.institutionName} className="sm:col-span-2">
                  <Input id="institutionName" {...form.register('institutionName')} />
                </Field>
                <Field label="Dirección" htmlFor="institutionAddress" error={errors.institutionAddress}>
                  <Input id="institutionAddress" {...form.register('institutionAddress')} />
                </Field>
                <Field label="Teléfono" htmlFor="institutionPhone" error={errors.institutionPhone}>
                  <Input id="institutionPhone" {...form.register('institutionPhone')} />
                </Field>
                <Field label="Sitio web" htmlFor="institutionWebsite" error={errors.institutionWebsite}>
                  <Input id="institutionWebsite" {...form.register('institutionWebsite')} />
                </Field>
                <Field label="RTN institucional" htmlFor="institutionRtn" error={errors.institutionRtn}>
                  <Input id="institutionRtn" {...form.register('institutionRtn')} />
                </Field>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="logoFile">Logo</Label>
                  <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center">
                    {values.logoUrl ? (
                      <img src={values.logoUrl} alt="Logo institucional" className="h-14 w-14 shrink-0 object-contain" />
                    ) : (
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-muted text-[10px] text-muted-foreground">Sin logo</div>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        id="logoFile"
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            const { data } = await comprasService.uploadInstitutionLogo(file);
                            form.setValue('logoUrl', data.settings.logoPath, { shouldDirty: true });
                            await Swal.fire({ icon: 'success', title: 'Logo cargado', text: 'Guarde el formato para aplicar el nuevo logo.', confirmButtonText: 'Aceptar' });
                          } catch {
                            await Swal.fire({ icon: 'error', title: 'No se pudo cargar el logo', confirmButtonText: 'Cerrar' });
                          }
                        }}
                      />
                      <Input id="logoUrl" {...form.register('logoUrl')} placeholder="/Logo_CNI.png" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documento</CardTitle>
                <CardDescription>Título, numeración y colores del formato impreso.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Título" htmlFor="documentTitle" error={errors.documentTitle}>
                  <Input id="documentTitle" {...form.register('documentTitle')} />
                </Field>
                <Field label="Prefijo" htmlFor="orderPrefix" error={errors.orderPrefix}>
                  <Input id="orderPrefix" {...form.register('orderPrefix')} placeholder="COM-CNI" />
                </Field>
                <ColorField
                  label="Color primario"
                  name="primaryColor"
                  value={values.primaryColor ?? DEFAULTS.primaryColor}
                  register={form.register}
                  error={errors.primaryColor}
                  onPick={(hex) => form.setValue('primaryColor', hex, { shouldDirty: true, shouldValidate: true })}
                />
                <ColorField
                  label="Color secundario"
                  name="secondaryColor"
                  value={values.secondaryColor ?? DEFAULTS.secondaryColor}
                  register={form.register}
                  error={errors.secondaryColor}
                  onPick={(hex) => form.setValue('secondaryColor', hex, { shouldDirty: true, shouldValidate: true })}
                />
                <Field label="Título de la firma" htmlFor="signatureTitle" error={errors.signatureTitle}>
                  <Input id="signatureTitle" {...form.register('signatureTitle')} />
                </Field>
                <Field label="Pie de página" htmlFor="footerText" error={errors.footerText}>
                  <Input id="footerText" {...form.register('footerText')} />
                </Field>
                <Field label="Nota adicional" htmlFor="additionalNote" error={errors.additionalNote} className="sm:col-span-2">
                  <Textarea id="additionalNote" rows={3} {...form.register('additionalNote')} className="field-sizing-fixed min-h-20 resize-y" />
                </Field>
              </CardContent>
            </Card>
          </div>

          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Vista previa</CardTitle>
                <CardDescription>Así se lee el encabezado con los datos actuales.</CardDescription>
              </CardHeader>
              <CardContent>
                <HeaderPreview values={{ ...DEFAULTS, ...values }} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visibilidad</CardTitle>
                <CardDescription>Qué líneas salen en el documento.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1">
                {VISIBILITY_FIELDS.map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-md px-1 py-2">
                    <Label htmlFor={key} className="font-normal">{label}</Label>
                    <Switch id={key} checked={Boolean(values[key])} onCheckedChange={(checked) => form.setValue(key, checked, { shouldDirty: true })} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </MainLayout>
  );
}
