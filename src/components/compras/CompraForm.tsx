'use client';

import { useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  COMPRA_FORMA_PAGO_LABELS,
  COMPRA_PRIORIDAD_LABELS,
  COMPRA_TIPO_LABELS,
  COMPRA_UNIDAD_LABELS,
} from '@/lib/compras/constants';
import { calcularTotalesCompra } from '@/lib/compras/calculos';
import { createCompraSolicitudSchema, type CreateCompraSolicitudInput } from '@/lib/compras/schemas';
import type { CompraSolicitud, Proveedor } from '@/types/compras';

interface CompraFormProps {
  departments: Array<{ id: string; name: string }>;
  centros: Array<{ id: string; code: string; name: string }>;
  proveedores: Proveedor[];
  defaultValues?: Partial<CompraSolicitud>;
  onSubmit: (data: CreateCompraSolicitudInput) => Promise<void>;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

const defaultItem = {
  descripcion: '',
  codigo: '',
  unidad: 'UNIDAD' as const,
  cantidad: 1,
  precioUnitario: 0,
};

export function CompraForm({
  departments,
  centros,
  proveedores,
  defaultValues,
  onSubmit,
  isSubmitting,
  readOnly,
}: CompraFormProps) {
  const form = useForm<CreateCompraSolicitudInput>({
    resolver: zodResolver(createCompraSolicitudSchema),
    defaultValues: {
      fechaSolicitud: defaultValues?.fechaSolicitud?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      fechaRequerida: defaultValues?.fechaRequerida?.slice(0, 10) ?? '',
      departamentoSolicitanteId: defaultValues?.departamentoSolicitanteId ?? '',
      centroCostoId: defaultValues?.centroCostoId ?? '',
      cargoSolicitante: defaultValues?.cargoSolicitante ?? '',
      tipoCompra: defaultValues?.tipoCompra ?? 'BIENES',
      prioridad: defaultValues?.prioridad ?? 'NORMAL',
      proveedorId: defaultValues?.proveedorId ?? undefined,
      justificacionCompra: defaultValues?.justificacionCompra ?? '',
      condicionesEntrega: defaultValues?.condicionesEntrega ?? '',
      observacionesAdicionales: defaultValues?.observacionesAdicionales ?? '',
      formaPago: defaultValues?.formaPago ?? 'CONTADO',
      plazoPagoDias: defaultValues?.plazoPagoDias ?? undefined,
      detallesPago: defaultValues?.detallesPago ?? '',
      descuento: defaultValues?.descuento ?? 0,
      items: defaultValues?.items?.length
        ? defaultValues.items.map((item) => ({
            item: item.item,
            codigo: item.codigo ?? '',
            descripcion: item.descripcion,
            unidad: item.unidad,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          }))
        : [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const watchedItems = form.watch('items');
  const descuento = form.watch('descuento') ?? 0;

  const totales = useMemo(
    () =>
      calcularTotalesCompra({
        items: (watchedItems ?? []).map((item) => ({
          cantidad: Number(item.cantidad) || 0,
          precioUnitario: Number(item.precioUnitario) || 0,
        })),
        descuento: Number(descuento) || 0,
      }),
    [watchedItems, descuento]
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>1. Información general</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Fecha de solicitud</Label>
            <Input type="date" disabled={readOnly} {...form.register('fechaSolicitud')} />
          </div>
          <div className="space-y-2">
            <Label>Fecha requerida</Label>
            <Input type="date" disabled={readOnly} {...form.register('fechaRequerida')} />
          </div>
          <div className="space-y-2">
            <Label>Departamento / Área</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" disabled={readOnly} {...form.register('departamentoSolicitanteId')}>
              <option value="">Seleccionar...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Centro de costo</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" disabled={readOnly} {...form.register('centroCostoId')}>
              <option value="">Seleccionar...</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Cargo solicitante</Label>
            <Input disabled={readOnly} {...form.register('cargoSolicitante')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Tipo de compra</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" disabled={readOnly} {...form.register('tipoCompra')}>
              {Object.entries(COMPRA_TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" disabled={readOnly} {...form.register('prioridad')}>
              {Object.entries(COMPRA_PRIORIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Información del proveedor</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label>Proveedor (opcional en solicitud interna)</Label>
          <select className="w-full rounded-md border px-3 py-2 text-sm" disabled={readOnly} {...form.register('proveedorId')}>
            <option value="">Sin proveedor asignado</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombreRazonSocial}</option>)}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>4. Detalle de bienes / servicios</CardTitle>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => append(defaultItem)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar ítem
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const lineTotal = totales.lineTotals[index] ?? 0;
            return (
              <div key={field.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-7">
                <Input placeholder="#" disabled value={String(index + 1)} className="md:col-span-1" />
                <Input placeholder="Código" disabled={readOnly} {...form.register(`items.${index}.codigo`)} />
                <Input placeholder="Descripción" disabled={readOnly} className="md:col-span-2" {...form.register(`items.${index}.descripcion`)} />
                <select className="rounded-md border px-3 py-2 text-sm" disabled={readOnly} {...form.register(`items.${index}.unidad`)}>
                  {Object.entries(COMPRA_UNIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <Input type="number" step="0.01" placeholder="Cant." disabled={readOnly} {...form.register(`items.${index}.cantidad`, { valueAsNumber: true })} />
                <Input type="number" step="0.01" placeholder="P. unit." disabled={readOnly} {...form.register(`items.${index}.precioUnitario`, { valueAsNumber: true })} />
                <div className="flex items-center justify-between gap-2 md:col-span-7">
                  <span className="text-sm font-medium">Total línea: L {lineTotal.toFixed(2)}</span>
                  {!readOnly && fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>5. Especificaciones y observaciones</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Justificación de la compra</Label>
            <Textarea rows={3} disabled={readOnly} {...form.register('justificacionCompra')} />
          </div>
          <div className="space-y-2">
            <Label>Condiciones de entrega</Label>
            <Textarea rows={2} disabled={readOnly} {...form.register('condicionesEntrega')} />
          </div>
          <div className="space-y-2">
            <Label>Observaciones adicionales</Label>
            <Textarea rows={2} disabled={readOnly} {...form.register('observacionesAdicionales')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>6. Condiciones de pago</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Forma de pago</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" disabled={readOnly} {...form.register('formaPago')}>
              {Object.entries(COMPRA_FORMA_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Plazo de pago (días)</Label>
            <Input type="number" disabled={readOnly} {...form.register('plazoPagoDias', { valueAsNumber: true })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Detalles de pago</Label>
            <Textarea rows={2} disabled={readOnly} {...form.register('detallesPago')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>7. Resumen</CardTitle></CardHeader>
        <CardContent className="grid gap-2 max-w-sm ml-auto text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>L {totales.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between items-center gap-2">
            <span>Descuento</span>
            <Input type="number" step="0.01" className="w-32 h-8" disabled={readOnly} {...form.register('descuento', { valueAsNumber: true })} />
          </div>
          <div className="flex justify-between"><span>Impuesto (15%)</span><span>L {totales.impuesto.toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold text-base border-t pt-2">
            <span>Total</span><span>L {totales.total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar solicitud'}
          </Button>
        </div>
      )}
    </form>
  );
}
