'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Swal from '@/lib/compras/orden/swal';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { compraOrdenService } from '@/services/compra-orden.service';
import { ordenKeys } from '@/hooks/useCompraOrden';
import { purchaseOrderTemplateSchema, type PurchaseOrderTemplateInput } from '@/lib/compras/orden/schemas';
import type { Role } from '@/types';
import { useRouter } from 'next/navigation';
import { comprasService } from '@/services/compras.service';

export default function ComprasTemplateSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<PurchaseOrderTemplateInput>({
    resolver: zodResolver(purchaseOrderTemplateSchema),
    defaultValues: {
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
    },
  });

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/settings');
  }, [user, router]);

  useEffect(() => {
    compraOrdenService.getTemplate().then(({ data }) => {
      const t = data.template as PurchaseOrderTemplateInput | null;
      if (t) form.reset(t);
    }).catch(() => undefined);
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
      <PageHeader title="Plantilla de Orden de Compra" description="Configuración institucional CNI (solo ADMIN)" />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle>Institución</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2"><Label>Nombre</Label><Input {...form.register('institutionName')} /></div>
            <div className="space-y-2"><Label>Dirección</Label><Input {...form.register('institutionAddress')} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input {...form.register('institutionPhone')} /></div>
            <div className="space-y-2"><Label>Sitio web</Label><Input {...form.register('institutionWebsite')} /></div>
            <div className="space-y-2"><Label>RTN institucional</Label><Input {...form.register('institutionRtn')} /></div>
            <div className="space-y-2 md:col-span-2">
              <Label>Logo institucional</Label>
              {form.watch('logoUrl') ? <img src={form.watch('logoUrl') ?? undefined} alt="Logo institucional" className="h-16 w-auto object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : null}
              <Input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const { data } = await comprasService.uploadInstitutionLogo(file);
                  form.setValue('logoUrl', data.settings.logoPath, { shouldDirty: true });
                  await Swal.fire({ icon: 'success', title: 'Logo cargado', text: 'Guarde el formato para aplicar el nuevo logo.', confirmButtonText: 'Aceptar' });
                } catch {
                  await Swal.fire({ icon: 'error', title: 'No se pudo cargar el logo', confirmButtonText: 'Cerrar' });
                }
              }} />
              <Input {...form.register('logoUrl')} placeholder="/Logo_CNI.png" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Documento</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Título del documento</Label><Input {...form.register('documentTitle')} /></div>
            <div className="space-y-2"><Label>Prefijo de numeración</Label><Input {...form.register('orderPrefix')} placeholder="COM-CNI" /></div>
            <div className="space-y-2"><Label>Color primario</Label><Input type="color" {...form.register('primaryColor')} /></div>
            <div className="space-y-2"><Label>Color secundario</Label><Input type="color" {...form.register('secondaryColor')} /></div>
            <div className="space-y-2"><Label>Título firma administrativa</Label><Input {...form.register('signatureTitle')} /></div>
            <div className="space-y-2"><Label>Pie de página</Label><Input {...form.register('footerText')} /></div>
            <div className="md:col-span-2 space-y-2"><Label>Nota adicional</Label><Textarea rows={2} {...form.register('additionalNote')} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Visibilidad</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {([
              ['showInstitutionAddress', 'Mostrar dirección'],
              ['showInstitutionPhone', 'Mostrar teléfono'],
              ['showInstitutionWebsite', 'Mostrar sitio web'],
              ['showInstitutionRtn', 'Mostrar RTN'],
              ['showReference', 'Mostrar referencia'],
              ['showRequiredDate', 'Mostrar fecha requerida'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={form.watch(key)} onCheckedChange={(v) => form.setValue(key, v)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit">Guardar plantilla (nueva versión)</Button>
      </form>
    </MainLayout>
  );
}
