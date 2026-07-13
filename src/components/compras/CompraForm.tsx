'use client';

import { useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  COMPRA_FORMA_PAGO_LABELS,
  COMPRA_NOTA_IMPORTANTE,
  COMPRA_PRIORIDAD_LABELS,
  COMPRA_TIPO_LABELS,
  COMPRA_UNIDAD_LABELS,
} from '@/lib/compras/constants';
import { calcularLineaTotal, calcularTotalesCompra } from '@/lib/compras/calculos';
import { borradorCompraSolicitudSchema, type BorradorCompraSolicitudInput } from '@/lib/compras/schemas';
import type { CompraSolicitud, Proveedor } from '@/types/compras';

interface SolicitanteInfo {
  nombre: string;
  cargo?: string;
  departmentId?: string;
}

interface CompraFormProps {
  departments: Array<{ id: string; name: string }>;
  centros: Array<{ id: string; code: string; name: string }>;
  proveedores?: Proveedor[];
  solicitante?: SolicitanteInfo;
  defaultValues?: Partial<CompraSolicitud>;
  onSubmit: (data: BorradorCompraSolicitudInput) => Promise<void>;
  isSubmitting?: boolean;
  readOnly?: boolean;
  showFirmas?: boolean;
  submitLabel?: string;
}

const defaultItem = {
  codigo: '',
  descripcion: '',
  unidad: 'UNIDAD' as const,
  cantidad: 1,
  precioUnitario: 0,
};

function toDateInput(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function CompraForm({
  departments,
  centros,
  proveedores = [],
  solicitante,
  defaultValues,
  onSubmit,
  isSubmitting,
  readOnly,
  showFirmas,
  submitLabel = 'Guardar borrador',
}: CompraFormProps) {
  const [useProveedorCatalogo, setUseProveedorCatalogo] = useState(
    !!defaultValues?.proveedorId
  );

  const form = useForm<BorradorCompraSolicitudInput>({
    resolver: zodResolver(borradorCompraSolicitudSchema),
    defaultValues: {
      fechaSolicitud: toDateInput(defaultValues?.fechaSolicitud) || new Date().toISOString().slice(0, 10),
      fechaRequerida: toDateInput(defaultValues?.fechaRequerida),
      departamentoSolicitanteId:
        defaultValues?.departamentoSolicitanteId ?? solicitante?.departmentId ?? '',
      centroCostoId: defaultValues?.centroCostoId ?? '',
      cargoSolicitante: defaultValues?.cargoSolicitante ?? solicitante?.cargo ?? '',
      tipoCompra: defaultValues?.tipoCompra ?? 'BIENES',
      prioridad: defaultValues?.prioridad ?? 'NORMAL',
      proveedorId: defaultValues?.proveedorId ?? null,
      proveedorNombre: defaultValues?.proveedorNombre ?? '',
      proveedorIdentificacion: defaultValues?.proveedorIdentificacion ?? '',
      proveedorTelefono: defaultValues?.proveedorTelefono ?? '',
      proveedorEmail: defaultValues?.proveedorEmail ?? '',
      proveedorContacto: defaultValues?.proveedorContacto ?? '',
      proveedorDireccion: defaultValues?.proveedorDireccion ?? '',
      justificacionCompra: defaultValues?.justificacionCompra ?? '',
      condicionesEntrega: defaultValues?.condicionesEntrega ?? '',
      observacionesAdicionales: defaultValues?.observacionesAdicionales ?? '',
      formaPago: defaultValues?.formaPago ?? 'CONTADO',
      plazoPagoDias: defaultValues?.plazoPagoDias ?? null,
      detallesPago: defaultValues?.detallesPago ?? '',
      descuento: defaultValues?.descuento ?? 0,
      items: defaultValues?.items?.length
        ? defaultValues.items.map((item) => ({
            item: item.item,
            codigo: item.codigo ?? '',
            descripcion: item.descripcion,
            unidad: item.unidad,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario ?? 0,
          }))
        : [{ ...defaultItem }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const watchedItems = form.watch('items');
  const watchedDescuento = form.watch('descuento') ?? 0;

  const totales = useMemo(() => {
    const items = (watchedItems ?? []).map((item) => ({
      cantidad: Number(item.cantidad) || 0,
      precioUnitario: Number(item.precioUnitario) || 0,
    }));
    return calcularTotalesCompra({ items, descuento: Number(watchedDescuento) || 0 });
  }, [watchedItems, watchedDescuento]);

  const handleProveedorSelect = (proveedorId: string) => {
    const p = proveedores.find((x) => x.id === proveedorId);
    form.setValue('proveedorId', proveedorId || null);
    if (p) {
      form.setValue('proveedorNombre', p.nombreRazonSocial);
      form.setValue('proveedorIdentificacion', p.rtn ?? '');
      form.setValue('proveedorTelefono', p.telefono ?? '');
      form.setValue('proveedorEmail', p.email ?? '');
      form.setValue('proveedorContacto', p.personaContacto ?? '');
      form.setValue('proveedorDireccion', p.direccion ?? '');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="text-center border rounded-lg p-4 bg-muted/30">
        <h2 className="text-lg font-bold tracking-wide">SOLICITUD Y ORDEN DE COMPRA</h2>
        <p className="text-sm text-muted-foreground">Bienes y Servicios</p>
        {defaultValues?.numero && (
          <p className="text-sm font-medium mt-1">No. {defaultValues.numero}</p>
        )}
      </div>

      {/* 1. Información General */}
      <Card>
        <CardHeader><CardTitle>1. Información General</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Fecha de Solicitud</Label>
            <Input type="date" disabled {...form.register('fechaSolicitud')} />
          </div>
          <div className="space-y-2">
            <Label>Fecha Requerida</Label>
            <Input type="date" disabled={readOnly} {...form.register('fechaRequerida')} />
          </div>
          <div className="space-y-2">
            <Label>Departamento / Área Solicitante</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              disabled={readOnly}
              {...form.register('departamentoSolicitanteId')}
            >
              <option value="">Seleccionar...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Centro de Costo</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              disabled={readOnly}
              {...form.register('centroCostoId')}
            >
              <option value="">Seleccionar...</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Solicitado por</Label>
            <Input
              disabled
              value={
                solicitante?.nombre ??
                (defaultValues?.solicitadoPor
                  ? `${defaultValues.solicitadoPor.firstName} ${defaultValues.solicitadoPor.lastName}`
                  : '')
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input disabled={readOnly} {...form.register('cargoSolicitante')} />
          </div>
        </CardContent>
      </Card>

      {/* 2. Tipo de Compra */}
      <Card>
        <CardHeader><CardTitle>2. Tipo de Compra</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              disabled={readOnly}
              {...form.register('tipoCompra')}
            >
              {Object.entries(COMPRA_TIPO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              disabled={readOnly}
              {...form.register('prioridad')}
            >
              {Object.entries(COMPRA_PRIORIDAD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 3. Información del Proveedor */}
      <Card>
        <CardHeader><CardTitle>3. Información del Proveedor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!readOnly && proveedores.length > 0 && (
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={useProveedorCatalogo}
                  onChange={() => setUseProveedorCatalogo(true)}
                />
                Seleccionar proveedor existente
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!useProveedorCatalogo}
                  onChange={() => {
                    setUseProveedorCatalogo(false);
                    form.setValue('proveedorId', null);
                  }}
                />
                Registrar datos directamente
              </label>
            </div>
          )}
          {useProveedorCatalogo && proveedores.length > 0 && !readOnly ? (
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                value={form.watch('proveedorId') ?? ''}
                onChange={(e) => handleProveedorSelect(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombreRazonSocial}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nombre o Razón Social</Label>
              <Input disabled={readOnly || (useProveedorCatalogo && !!form.watch('proveedorId'))} {...form.register('proveedorNombre')} />
            </div>
            <div className="space-y-2">
              <Label>RTN / Identificación</Label>
              <Input disabled={readOnly} {...form.register('proveedorIdentificacion')} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input disabled={readOnly} {...form.register('proveedorTelefono')} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" disabled={readOnly} {...form.register('proveedorEmail')} />
            </div>
            <div className="space-y-2">
              <Label>Persona de Contacto</Label>
              <Input disabled={readOnly} {...form.register('proveedorContacto')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Dirección</Label>
              <Textarea rows={2} disabled={readOnly} {...form.register('proveedorDireccion')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Detalle de Bienes / Servicios */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>4. Detalle de Bienes / Servicios Solicitados</CardTitle>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => append({ ...defaultItem })}>
              <Plus className="h-4 w-4 mr-1" /> Agregar fila
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Item</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Precio Unit.</TableHead>
                <TableHead>Total</TableHead>
                {!readOnly && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const cantidad = Number(watchedItems?.[index]?.cantidad) || 0;
                const precio = Number(watchedItems?.[index]?.precioUnitario) || 0;
                const lineTotal = calcularLineaTotal(cantidad, precio);
                return (
                  <TableRow key={field.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Input className="h-8" disabled={readOnly} {...form.register(`items.${index}.codigo`)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8" disabled={readOnly} {...form.register(`items.${index}.descripcion`)} />
                    </TableCell>
                    <TableCell>
                      <select
                        className="w-full rounded-md border px-2 py-1 text-sm h-8 bg-background"
                        disabled={readOnly}
                        {...form.register(`items.${index}.unidad`)}
                      >
                        {Object.entries(COMPRA_UNIDAD_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        {...form.register(`items.${index}.cantidad`, { valueAsNumber: true })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        {...form.register(`items.${index}.precioUnitario`, { valueAsNumber: true })}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      L. {lineTotal.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        {fields.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 w-full max-w-xs">
              <span>Subtotal:</span>
              <span className="text-right">L. {totales.subtotal.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
              <span>Descuento (monto):</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="h-8"
                disabled={readOnly}
                {...form.register('descuento', { valueAsNumber: true })}
              />
              <span>Impuesto (15%):</span>
              <span className="text-right">L. {totales.impuesto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
              <span className="font-bold">Total:</span>
              <span className="text-right font-bold">
                L. {totales.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Especificaciones y Observaciones */}
      <Card>
        <CardHeader><CardTitle>5. Especificaciones y Observaciones</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Justificación de la Compra</Label>
            <Textarea rows={3} disabled={readOnly} {...form.register('justificacionCompra')} />
          </div>
          <div className="space-y-2">
            <Label>Condiciones de entrega</Label>
            <Textarea rows={2} disabled={readOnly} {...form.register('condicionesEntrega')} />
          </div>
          <div className="space-y-2">
            <Label>Observaciones Adicionales</Label>
            <Textarea rows={2} disabled={readOnly} {...form.register('observacionesAdicionales')} />
          </div>
        </CardContent>
      </Card>

      {/* 6. Condiciones de Pago */}
      <Card>
        <CardHeader><CardTitle>6. Condiciones de Pago</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Forma de pago</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              disabled={readOnly}
              {...form.register('formaPago')}
            >
              {Object.entries(COMPRA_FORMA_PAGO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Plazo de Pago (días)</Label>
            <Input
              type="number"
              disabled={readOnly}
              {...form.register('plazoPagoDias', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Detalles de Pago</Label>
            <Textarea rows={2} disabled={readOnly} {...form.register('detallesPago')} />
          </div>
        </CardContent>
      </Card>

      {/* Nota importante (solo lectura) */}
      <Card>
        <CardHeader><CardTitle>Nota Importante</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{COMPRA_NOTA_IMPORTANTE}</p>
        </CardContent>
      </Card>

      {/* 7. Firmas */}
      {(showFirmas || readOnly) && (
        <Card>
          <CardHeader><CardTitle>7. Firmas y Autorizaciones</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3 text-center text-sm">
              <div className="space-y-2">
                <p className="font-semibold uppercase">Solicitante</p>
                <p>
                  {defaultValues?.solicitadoPor
                    ? `${defaultValues.solicitadoPor.firstName} ${defaultValues.solicitadoPor.lastName}`
                    : solicitante?.nombre ?? '—'}
                </p>
                <p className="text-muted-foreground">{defaultValues?.cargoSolicitante ?? solicitante?.cargo}</p>
                <Separator className="mt-8" />
                <p className="text-xs text-muted-foreground">Nombre y Firma</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold uppercase">Autorizado por</p>
                <p>Jefe de Departamento</p>
                {defaultValues?.autorizadoPor ? (
                  <p>{defaultValues.autorizadoPor.firstName} {defaultValues.autorizadoPor.lastName}</p>
                ) : (
                  <p className="text-muted-foreground">Pendiente</p>
                )}
                {defaultValues?.autorizadoEn && (
                  <p className="text-xs">{new Date(defaultValues.autorizadoEn).toLocaleDateString('es-HN')}</p>
                )}
                <Separator className="mt-8" />
                <p className="text-xs text-muted-foreground">Nombre y Firma</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold uppercase">Aprobado por</p>
                <p>Gerencia / Finanzas</p>
                {defaultValues?.aprobadoPor ? (
                  <p>{defaultValues.aprobadoPor.firstName} {defaultValues.aprobadoPor.lastName}</p>
                ) : (
                  <p className="text-muted-foreground">Pendiente</p>
                )}
                {defaultValues?.aprobadoEn && (
                  <p className="text-xs">{new Date(defaultValues.aprobadoEn).toLocaleDateString('es-HN')}</p>
                )}
                <Separator className="mt-8" />
                <p className="text-xs text-muted-foreground">Nombre y Firma</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!readOnly && (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : submitLabel}
        </Button>
      )}
    </form>
  );
}
