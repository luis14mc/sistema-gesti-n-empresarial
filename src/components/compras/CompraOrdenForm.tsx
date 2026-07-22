'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { useForm, useFieldArray, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import Swal from '@/lib/compras/orden/swal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getFirstErrorField, getFirstFormErrorMessage } from '@/lib/form-errors';
import { UNIT_LABELS } from '@/lib/compras/orden/constants';
import { calculatePurchaseOrder, toDecimal } from '@/lib/compras/orden/calculos';
import {
  createPurchaseOrderSchema,
  draftPurchaseOrderSchema,
  ISV_RATES,
  type CreatePurchaseOrderInput,
  type DraftPurchaseOrderInput,
} from '@/lib/compras/orden/schemas';
import type { CompraOrden } from '@/types/compra-orden';
import type { Proveedor } from '@/types/compras';
import type { FieldErrors } from 'react-hook-form';

interface CompraOrdenFormProps {
  proveedores?: Proveedor[];
  defaultValues?: Partial<CompraOrden>;
  onSubmit: (data: DraftPurchaseOrderInput) => Promise<void>;
  onValuesChange?: (data: DraftPurchaseOrderInput) => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
  submitLabel?: string;
  formId?: string;
  hideActions?: boolean;
}

export interface CompraOrdenFormHandle {
  validateForGeneration: () => Promise<CreatePurchaseOrderInput | null>;
}

const defaultItem = { description: '', unit: 'UNIT' as const, quantity: 1, unitPrice: 0 };

function toDateInput(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function mapDefaults(v?: Partial<CompraOrden>): Partial<CreatePurchaseOrderInput> {
  if (!v) return {};
  return {
    purchaseReference: v.purchaseReference ?? v.referenciaCompra ?? '',
    requestDate: toDateInput(v.requestDate ?? v.fechaSolicitud) || new Date().toISOString().slice(0, 10),
    requiredDate: toDateInput(v.requiredDate ?? v.fechaRequerida),
    requestedByName: v.requestedByName ?? v.solicitadoPorNombre ?? '',
    requesterJobTitle: v.requesterJobTitle ?? v.cargoSolicitante ?? '',
    supplierId: v.supplierId ?? v.proveedorId ?? null,
    supplierName: v.supplierName ?? v.proveedorNombre ?? '',
    supplierRtn: v.supplierRtn ?? v.proveedorRtn ?? '',
    supplierPhone: v.supplierPhone ?? v.proveedorTelefono ?? '',
    purchaseJustification: v.purchaseJustification ?? v.justificacionCompra ?? '',
    discountType: v.discountType ?? ((v.discount ?? v.descuento ?? 0) > 0 ? 'MONTO' : 'NINGUNO'),
    discountValue: v.discountValue ?? v.discount ?? v.descuento ?? 0,
    taxRate: v.taxRate ?? v.tasaImpuesto ?? 15,
    items: v.items?.length
      ? v.items.map((i) => ({
          itemNumber: i.itemNumber ?? (i as { item?: number }).item,
          description: i.description ?? (i as { descripcion?: string }).descripcion ?? '',
          unit: (i.unit ?? (i as { unidad?: string }).unidad ?? 'UNIT') as CreatePurchaseOrderInput['items'][0]['unit'],
          quantity: i.quantity ?? (i as { cantidad?: number }).cantidad ?? 1,
          unitPrice: i.unitPrice ?? (i as { precioUnitario?: number }).precioUnitario ?? 0,
        }))
      : [{ ...defaultItem }],
  };
}

function formatMoney(value: number): string {
  return `L. ${value.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export const CompraOrdenForm = forwardRef<CompraOrdenFormHandle, CompraOrdenFormProps>(
function CompraOrdenForm({
  proveedores = [],
  defaultValues,
  onSubmit,
  onValuesChange,
  isSubmitting,
  readOnly,
  submitLabel = 'Guardar borrador',
  formId,
  hideActions = false,
}, ref) {
  const mapped = mapDefaults(defaultValues);
  const form = useForm<DraftPurchaseOrderInput>({
    resolver: zodResolver(draftPurchaseOrderSchema) as Resolver<DraftPurchaseOrderInput>,
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      requestDate: mapped.requestDate || new Date().toISOString().slice(0, 10),
      requiredDate: mapped.requiredDate ?? '',
      purchaseReference: mapped.purchaseReference ?? '',
      requestedByName: mapped.requestedByName ?? '',
      requesterJobTitle: mapped.requesterJobTitle ?? '',
      supplierId: mapped.supplierId ?? null,
      supplierName: mapped.supplierName ?? '',
      supplierRtn: mapped.supplierRtn ?? '',
      supplierPhone: mapped.supplierPhone ?? '',
      purchaseJustification: mapped.purchaseJustification ?? '',
      discountType: mapped.discountType ?? 'NINGUNO',
      discountValue: mapped.discountValue ?? 0,
      taxRate: mapped.taxRate ?? 15,
      items: mapped.items?.length ? mapped.items : [{ ...defaultItem }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  const watchedItems = useWatch({ control: form.control, name: 'items' }) ?? [];
  const watchedDiscountType = useWatch({ control: form.control, name: 'discountType' }) ?? 'NINGUNO';
  const watchedDiscountValue = useWatch({ control: form.control, name: 'discountValue' }) ?? 0;
  const watchedTaxRate = useWatch({ control: form.control, name: 'taxRate' }) ?? 15;
  const watchedSupplierId = useWatch({ control: form.control, name: 'supplierId' });

  const watchedValues = useWatch({ control: form.control });

  useEffect(() => {
    if (!onValuesChange) return;
    onValuesChange(form.getValues());
  }, [watchedValues, onValuesChange, form]);

  const totales = useMemo(() => {
    const normalizedItems = watchedItems.map((item) => ({
      quantity: Number.isFinite(Number(item?.quantity)) ? Number(item!.quantity) : 0,
      unitPrice: Number.isFinite(Number(item?.unitPrice)) ? Number(item!.unitPrice) : 0,
    }));

    return calculatePurchaseOrder({
      items: normalizedItems.map((item) => ({
        quantity: toDecimal(item.quantity),
        unitPrice: toDecimal(item.unitPrice),
      })),
      discountType: watchedDiscountType,
      discountValue: toDecimal(Number.isFinite(Number(watchedDiscountValue)) ? Number(watchedDiscountValue) : 0),
      taxRate: toDecimal(Number.isFinite(Number(watchedTaxRate)) ? Number(watchedTaxRate) : 15),
    });
  }, [watchedItems, watchedDiscountType, watchedDiscountValue, watchedTaxRate]);

  const handleDiscountToggle = (enabled: boolean) => {
    form.setValue('discountType', enabled ? 'MONTO' : 'NINGUNO', {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (!enabled) {
      form.setValue('discountValue', 0, { shouldDirty: true, shouldValidate: true });
    }
  };

  const handleSupplierSelect = (supplierId: string) => {
    if (!supplierId) {
      form.setValue('supplierId', null);
      return;
    }
    const p = proveedores.find((x) => x.id === supplierId);
    form.setValue('supplierId', supplierId);
    if (p) {
      form.setValue('supplierName', p.nombreRazonSocial);
      form.setValue('supplierRtn', p.rtn ?? '');
      form.setValue('supplierPhone', p.telefono ?? '');
    }
  };

  useImperativeHandle(ref, () => ({
    async validateForGeneration() {
      const values = form.getValues();
      const parsed = createPurchaseOrderSchema.safeParse(values);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((issue) => issue.message);
        await Swal.fire({
          icon: 'warning',
          title: 'Revise el formulario',
          html: (() => {
            const list = document.createElement('ul');
            list.className = 'space-y-1 text-left';
            for (const message of messages) {
              const item = document.createElement('li');
              item.textContent = `• ${message}`;
              list.appendChild(item);
            }
            return list;
          })(),
          confirmButtonText: 'Revisar',
        });
        const firstPath = parsed.error.issues[0]?.path.join('.');
        if (firstPath) {
          form.setFocus(firstPath as keyof DraftPurchaseOrderInput);
        }
        return null;
      }
      return parsed.data;
    },
  }), [form]);

  const handleValidSubmit = async (data: DraftPurchaseOrderInput) => {
    try {
      await onSubmit(data);
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: 'Ocurrió un error al guardar la orden.', confirmButtonText: 'Cerrar' });
    }
  };

  const handleInvalidSubmit = (errors: FieldErrors<CreatePurchaseOrderInput>) => {
    console.error('Purchase order validation errors:', errors);

    const firstMessage = getFirstFormErrorMessage(errors);

    void Swal.fire({ icon: 'warning', title: 'Revise el formulario', text: firstMessage ?? 'Hay campos incompletos o inválidos.', confirmButtonText: 'Aceptar' });

    const firstErrorField = getFirstErrorField(errors);
    if (firstErrorField) {
      form.setFocus(firstErrorField as keyof CreatePurchaseOrderInput);
    }
  };

  const { errors } = form.formState;
  const hasErrors = Object.keys(errors).length > 0;
  const submitting = isSubmitting || form.formState.isSubmitting;

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(handleValidSubmit, handleInvalidSubmit)}
      className="space-y-6"
      noValidate
    >

      <Card>
        <CardHeader><CardTitle>1. Información general</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="requestDate">Fecha solicitud</Label>
            <Input
              id="requestDate"
              type="date"
              disabled
              aria-invalid={Boolean(errors.requestDate)}
              className={cn(errors.requestDate && 'border-destructive')}
              {...form.register('requestDate')}
            />
            <FieldError message={errors.requestDate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requiredDate">Fecha requerida *</Label>
            <Input
              id="requiredDate"
              type="date"
              disabled={readOnly}
              aria-invalid={Boolean(errors.requiredDate)}
              className={cn(errors.requiredDate && 'border-destructive')}
              {...form.register('requiredDate')}
            />
            <FieldError message={errors.requiredDate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requestedByName">Solicitado por *</Label>
            <Input
              id="requestedByName"
              disabled={readOnly}
              placeholder="Nombre de quien solicita"
              aria-invalid={Boolean(errors.requestedByName)}
              className={cn(errors.requestedByName && 'border-destructive')}
              {...form.register('requestedByName')}
            />
            <FieldError message={errors.requestedByName?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requesterJobTitle">Cargo *</Label>
            <Input
              id="requesterJobTitle"
              disabled={readOnly}
              placeholder="Cargo del solicitante"
              aria-invalid={Boolean(errors.requesterJobTitle)}
              className={cn(errors.requesterJobTitle && 'border-destructive')}
              {...form.register('requesterJobTitle')}
            />
            <FieldError message={errors.requesterJobTitle?.message} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="purchaseReference">Referencia de compra *</Label>
            <Input
              id="purchaseReference"
              disabled={readOnly}
              aria-invalid={Boolean(errors.purchaseReference)}
              className={cn(errors.purchaseReference && 'border-destructive')}
              {...form.register('purchaseReference')}
            />
            <FieldError message={errors.purchaseReference?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Proveedor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!readOnly && proveedores.length > 0 && (
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={watchedSupplierId ?? ''}
              onChange={(e) => handleSupplierSelect(e.target.value)}
            >
              <option value="">— Manual —</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombreRazonSocial}</option>
              ))}
            </select>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="supplierName">Nombre / razón social *</Label>
              <Input
                id="supplierName"
                disabled={readOnly}
                aria-invalid={Boolean(errors.supplierName)}
                className={cn(errors.supplierName && 'border-destructive')}
                {...form.register('supplierName')}
              />
              <FieldError message={errors.supplierName?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierRtn">RTN *</Label>
              <Input
                id="supplierRtn"
                disabled={readOnly}
                aria-invalid={Boolean(errors.supplierRtn)}
                className={cn(errors.supplierRtn && 'border-destructive')}
                {...form.register('supplierRtn')}
              />
              <FieldError message={errors.supplierRtn?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierPhone">Teléfono *</Label>
              <Input
                id="supplierPhone"
                disabled={readOnly}
                aria-invalid={Boolean(errors.supplierPhone)}
                className={cn(errors.supplierPhone && 'border-destructive')}
                {...form.register('supplierPhone')}
              />
              <FieldError message={errors.supplierPhone?.message} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>3. Detalle de compra</CardTitle>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => append({ ...defaultItem })}>
              <Plus className="h-4 w-4 mr-1" />Ítem
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Cant.</TableHead>
                <TableHead>P. unit.</TableHead>
                <TableHead>Total</TableHead>
                {!readOnly && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const quantity = Number(watchedItems[index]?.quantity) || 0;
                const unitPrice = Number(watchedItems[index]?.unitPrice) || 0;
                const lineTotal = totales.lineTotals[index]?.toNumber() ?? quantity * unitPrice;
                const itemErrors = errors.items?.[index];

                return (
                  <TableRow key={field.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Input
                        className={cn('h-8', itemErrors?.description && 'border-destructive')}
                        disabled={readOnly}
                        aria-invalid={Boolean(itemErrors?.description)}
                        {...form.register(`items.${index}.description`)}
                      />
                      <FieldError message={itemErrors?.description?.message} />
                    </TableCell>
                    <TableCell>
                      <select
                        className="w-full rounded-md border px-2 py-1 text-sm h-8"
                        disabled={readOnly}
                        {...form.register(`items.${index}.unit`)}
                      >
                        {Object.entries(UNIT_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className={cn('h-8', itemErrors?.quantity && 'border-destructive')}
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={readOnly}
                        aria-invalid={Boolean(itemErrors?.quantity)}
                        {...form.register(`items.${index}.quantity`, {
                          setValueAs: (value) =>
                            value === '' || value === null || value === undefined
                              ? 0
                              : Number(value),
                        })}
                      />
                      <FieldError message={itemErrors?.quantity?.message} />
                    </TableCell>
                    <TableCell>
                      <Input
                        className={cn('h-8', itemErrors?.unitPrice && 'border-destructive')}
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={readOnly}
                        aria-invalid={Boolean(itemErrors?.unitPrice)}
                        {...form.register(`items.${index}.unitPrice`, {
                          setValueAs: (value) =>
                            value === '' || value === null || value === undefined
                              ? 0
                              : Number(value),
                        })}
                      />
                      <FieldError message={itemErrors?.unitPrice?.message} />
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(lineTotal)}</TableCell>
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
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 w-full max-w-sm ml-auto text-sm">
            <span>Subtotal:</span>
            <span className="text-right">{formatMoney(totales.subtotal.toNumber())}</span>
            <Label htmlFor="hasDiscount">¿Aplica descuento?</Label>
            <input
              id="hasDiscount"
              type="checkbox"
              className="h-4 w-4 justify-self-end accent-primary"
              checked={watchedDiscountType !== 'NINGUNO'}
              disabled={readOnly}
              onChange={(event) => handleDiscountToggle(event.target.checked)}
            />
            {watchedDiscountType !== 'NINGUNO' ? (
              <>
                <Label htmlFor="discountType">Tipo de descuento</Label>
                <select
                  id="discountType"
                  className="h-8 rounded-md border px-2 text-sm"
                  disabled={readOnly}
                  {...form.register('discountType', {
                    onChange: (event) => {
                      if (event.target.value === 'NINGUNO') {
                        form.setValue('discountValue', 0, { shouldDirty: true, shouldValidate: true });
                      }
                    },
                  })}
                >
                  <option value="MONTO">Monto fijo</option>
                  <option value="PORCENTAJE">Porcentaje</option>
                </select>
                <Label htmlFor="discountValue">
                  {watchedDiscountType === 'PORCENTAJE' ? 'Porcentaje de descuento' : 'Monto del descuento'}
                </Label>
                <div className="space-y-1">
                  <Input
                    id="discountValue"
                    type="number"
                    step="0.01"
                    min="0"
                    max={watchedDiscountType === 'PORCENTAJE' ? 100 : undefined}
                    className={cn('h-8', errors.discountValue && 'border-destructive')}
                    disabled={readOnly}
                    aria-invalid={Boolean(errors.discountValue)}
                    {...form.register('discountValue', {
                      setValueAs: (value) =>
                        value === '' || value === null || value === undefined ? 0 : Number(value),
                    })}
                  />
                  <FieldError message={errors.discountValue?.message} />
                </div>
              </>
            ) : null}
            <span>Descuento aplicado:</span>
            <span className="text-right">{formatMoney(totales.discount.toNumber())}</span>
            <span>Base gravable:</span>
            <span className="text-right">{formatMoney(totales.taxableBase.toNumber())}</span>
            <Label htmlFor="taxRate">ISV:</Label>
            <div className="space-y-1">
              <select
                id="taxRate"
                className={cn('h-8 w-full rounded-md border px-2 text-sm', errors.taxRate && 'border-destructive')}
                disabled={readOnly}
                aria-invalid={Boolean(errors.taxRate)}
                {...form.register('taxRate', {
                  setValueAs: Number,
                })}
              >
                {ISV_RATES.map((rate) => <option key={rate.value} value={rate.value}>{rate.label}</option>)}
              </select>
              <FieldError message={errors.taxRate?.message} />
            </div>
            <span>ISV {watchedTaxRate}%:</span>
            <span className="text-right">{formatMoney(totales.tax.toNumber())}</span>
            <span className="font-bold">Total:</span>
            <span className="text-right font-bold">{formatMoney(totales.total.toNumber())}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4. Justificación</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="purchaseJustification">Justificación de compra *</Label>
            <Textarea
              id="purchaseJustification"
              rows={4}
              disabled={readOnly}
              aria-invalid={Boolean(errors.purchaseJustification)}
              className={cn(errors.purchaseJustification && 'border-destructive')}
              {...form.register('purchaseJustification')}
            />
            <FieldError message={errors.purchaseJustification?.message} />
          </div>
        </CardContent>
      </Card>

      {!readOnly && !hideActions && (
        <>
          {hasErrors && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="font-medium text-destructive">No se puede guardar la orden</p>
              <p className="text-sm text-muted-foreground">Revise los campos marcados.</p>
            </div>
          )}
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Guardando...' : submitLabel}
          </Button>
        </>
      )}
    </form>
  );
});

CompraOrdenForm.displayName = 'CompraOrdenForm';
