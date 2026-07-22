import { z } from 'zod';
import { validateRtn } from '@/lib/compras/validation';

export const PURCHASE_UNITS = [
  'UNIT', 'BOX', 'PACKAGE', 'SERVICE', 'LOT', 'MONTH', 'HOUR', 'DAY', 'OTHER',
] as const;

export const ISV_RATES = [
  { value: 0, label: 'Exento (0%)' },
  { value: 15, label: 'ISV 15%' },
  { value: 18, label: 'ISV 18%' },
] as const;

export const discountTypeSchema = z.enum(['NINGUNO', 'MONTO', 'PORCENTAJE']);

export const purchaseOrderItemSchema = z.object({
  itemNumber: z.number().int().positive().optional(),
  description: z.string().trim().min(2, 'Descripción requerida (mín. 2 caracteres)'),
  unit: z.enum(PURCHASE_UNITS),
  quantity: z.number({ message: 'Cantidad inválida' }).positive('Cantidad debe ser mayor a 0'),
  unitPrice: z.number({ message: 'Precio inválido' }).min(0, 'Precio unitario no puede ser negativo'),
});

export const draftPurchaseOrderItemSchema = z.object({
  itemNumber: z.number().int().positive().optional(),
  description: z.string().trim().default(''),
  unit: z.enum(PURCHASE_UNITS).default('UNIT'),
  quantity: z.number().min(0, 'Cantidad inválida').default(1),
  unitPrice: z.number().min(0, 'Precio inválido').default(0),
});

export const draftPurchaseOrderSchema = z.object({
  purchaseReference: z.string().trim().default(''),
  requestDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
  requiredDate: z.string().default(''),
  requestedByName: z.string().trim().default(''),
  requesterJobTitle: z.string().trim().default(''),
  supplierId: z.string().nullable().optional(),
  supplierName: z.string().trim().default(''),
  supplierRtn: z.string().trim().default(''),
  supplierPhone: z.string().trim().default(''),
  purchaseJustification: z.string().trim().default(''),
  discountType: discountTypeSchema.default('NINGUNO'),
  discountValue: z.number().min(0, 'Descuento no puede ser negativo').default(0),
  taxRate: z.number().default(15),
  items: z.array(draftPurchaseOrderItemSchema).default([]),
});

export const createPurchaseOrderSchema = z.object({
  purchaseReference: z.string().trim(),
  requestDate: z.string().min(1, 'Fecha de solicitud requerida'),
  requiredDate: z.string().min(1, 'Fecha requerida obligatoria'),
  requestedByName: z.string().trim().min(2, 'Nombre del solicitante requerido'),
  requesterJobTitle: z.string().trim().min(2, 'Cargo del solicitante requerido'),
  supplierId: z.string().optional().nullable(),
  supplierName: z.string().trim().min(2, 'Nombre del proveedor requerido'),
  supplierRtn: z
    .string()
    .trim()
    .min(1, 'RTN del proveedor requerido')
    .refine((value) => validateRtn(value), 'El RTN debe tener 14 dígitos'),
  supplierPhone: z.string().trim().min(7, 'Teléfono del proveedor requerido'),
  purchaseJustification: z.string().trim().min(10, 'Justificación requerida (mín. 10 caracteres)'),
  discountType: discountTypeSchema,
  discountValue: z.number({ message: 'Descuento inválido' }).min(0, 'Descuento no puede ser negativo'),
  taxRate: z.number({ message: 'Tasa de ISV inválida' }).refine(
    (value) => [0, 15, 18].includes(value),
    'Seleccione una tasa de ISV válida.'
  ),
  items: z.array(purchaseOrderItemSchema).min(1, 'Debe incluir al menos un ítem'),
}).superRefine((data, ctx) => {
  const request = new Date(data.requestDate);
  const required = new Date(data.requiredDate);
  if (!Number.isNaN(request.getTime()) && !Number.isNaN(required.getTime()) && required < request) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requiredDate'],
      message: 'La fecha requerida no puede ser anterior a la fecha de solicitud',
    });
  }
  if (data.discountType === 'PORCENTAJE' && data.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'El descuento porcentual no puede superar el 100%.',
    });
  }
  if (data.discountType === 'NINGUNO' && data.discountValue !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Una orden sin descuento debe tener valor cero.',
    });
  }
  if (data.discountType === 'MONTO') {
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    if (data.discountValue > subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'El descuento fijo no puede superar el subtotal.',
      });
    }
  }
});

export const updatePurchaseOrderSchema = draftPurchaseOrderSchema;

export const cancelOrderSchema = z.object({
  cancellationReason: z.string().trim().min(5),
});

export const anularOrdenSchema = z.object({
  cancellationReason: z.string().trim().min(5).optional(),
  motivoAnulacion: z.string().trim().min(5).optional(),
}).refine((d) => d.cancellationReason || d.motivoAnulacion, {
  message: 'Motivo de anulación requerido',
}).transform((d) => ({
  cancellationReason: (d.cancellationReason ?? d.motivoAnulacion)!,
}));

export const purchaseOrderTemplateSchema = z.object({
  name: z.string().trim().min(2),
  logoUrl: z.string().optional().nullable(),
  institutionName: z.string().trim().min(2),
  institutionAddress: z.string().optional().nullable(),
  institutionPhone: z.string().optional().nullable(),
  institutionWebsite: z.string().optional().nullable(),
  institutionRtn: z.string().optional().nullable(),
  documentTitle: z.string().trim().min(2),
  orderPrefix: z.string().trim().min(2).max(20),
  footerText: z.string().optional().nullable(),
  signatureTitle: z.string().trim().min(2),
  additionalNote: z.string().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  showInstitutionAddress: z.boolean(),
  showInstitutionPhone: z.boolean(),
  showInstitutionWebsite: z.boolean(),
  showInstitutionRtn: z.boolean(),
  showReference: z.boolean(),
  showRequiredDate: z.boolean(),
});

export type DraftPurchaseOrderInput = z.infer<typeof draftPurchaseOrderSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type PurchaseOrderTemplateInput = z.infer<typeof purchaseOrderTemplateSchema>;

/** Aplica defaults de API alineados con el servicio (discount 0, taxRate 15). */
export function normalizePurchaseOrderPayload(body: unknown) {
  if (typeof body !== 'object' || body === null) return body;
  const payload = body as Record<string, unknown>;
  const legacyDiscount = typeof payload.discount === 'number' ? payload.discount : 0;
  return {
    discountType: legacyDiscount > 0 ? 'MONTO' : 'NINGUNO',
    discountValue: legacyDiscount,
    taxRate: 15,
    ...payload,
  };
}

// Aliases for API layer
export const createCompraOrdenSchema = draftPurchaseOrderSchema;
export type CreateCompraOrdenInput = DraftPurchaseOrderInput;
export const updateCompraOrdenSchema = draftPurchaseOrderSchema;
