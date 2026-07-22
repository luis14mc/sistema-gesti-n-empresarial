import { Prisma } from '@prisma/client';
import { validateRtn } from '@/lib/compras/validation';

export type PurchaseOrderValidationError = {
  field: string;
  message: string;
};

export type PurchaseOrderWithItems = Prisma.CompraOrdenGetPayload<{
  include: { items: true };
}>;

export class InvalidPurchaseOrderError extends Error {
  readonly validationErrors: PurchaseOrderValidationError[];

  constructor(validationErrors: PurchaseOrderValidationError[]) {
    super('INVALID_ORDER_DATA');
    this.name = 'InvalidPurchaseOrderError';
    this.validationErrors = validationErrors;
  }
}

export function validatePurchaseOrderForGeneration(
  order: PurchaseOrderWithItems
): PurchaseOrderValidationError[] {
  const errors: PurchaseOrderValidationError[] = [];

  if (!order.orderNumber?.trim()) {
    errors.push({ field: 'numero', message: 'La orden no tiene correlativo.' });
  }

  const requestDate = new Date(order.requestDate);
  const requiredDate = new Date(order.requiredDate);
  if (Number.isNaN(requestDate.getTime())) {
    errors.push({ field: 'fecha', message: 'La fecha de la orden no es válida.' });
  }
  if (Number.isNaN(requiredDate.getTime())) {
    errors.push({ field: 'fechaRequerida', message: 'La fecha requerida no es válida.' });
  }
  if (
    !Number.isNaN(requestDate.getTime()) &&
    !Number.isNaN(requiredDate.getTime()) &&
    requiredDate < requestDate
  ) {
    errors.push({
      field: 'fechaRequerida',
      message: 'La fecha requerida no puede ser anterior a la fecha de la orden.',
    });
  }

  if (!order.requestedByName?.trim()) {
    errors.push({ field: 'solicitadoPor', message: 'El nombre del solicitante es obligatorio.' });
  }
  if (!order.requesterJobTitle?.trim()) {
    errors.push({ field: 'cargoSolicitante', message: 'El cargo del solicitante es obligatorio.' });
  }
  if (!order.supplierName?.trim()) {
    errors.push({ field: 'proveedorNombre', message: 'El proveedor es obligatorio.' });
  }
  if (!order.supplierRtn?.trim()) {
    errors.push({ field: 'proveedorRtn', message: 'El RTN del proveedor es obligatorio.' });
  } else if (!validateRtn(order.supplierRtn)) {
    errors.push({ field: 'proveedorRtn', message: 'El RTN debe tener 14 dígitos.' });
  }
  if (!order.supplierPhone?.trim()) {
    errors.push({ field: 'proveedorTelefono', message: 'El teléfono del proveedor es obligatorio.' });
  }
  if (!order.purchaseJustification?.trim() || order.purchaseJustification.trim().length < 10) {
    errors.push({
      field: 'justificacion',
      message: 'La justificación debe tener al menos 10 caracteres.',
    });
  }

  if (!order.items.length) {
    errors.push({ field: 'items', message: 'Debe incluir al menos un ítem.' });
  }
  order.items.forEach((item, index) => {
    if (!item.description?.trim()) {
      errors.push({
        field: `items.${index}.descripcion`,
        message: `El ítem ${index + 1} necesita una descripción.`,
      });
    }
    if (!item.unit?.trim()) {
      errors.push({
        field: `items.${index}.unidad`,
        message: `El ítem ${index + 1} necesita una unidad.`,
      });
    }

    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({
        field: `items.${index}.cantidad`,
        message: `La cantidad del ítem ${index + 1} debe ser mayor a cero.`,
      });
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push({
        field: `items.${index}.precioUnitario`,
        message: `El precio del ítem ${index + 1} no es válido.`,
      });
    }
  });

  const taxRate = Number(order.taxRate);
  if (![0, 15, 18].includes(taxRate)) {
    errors.push({ field: 'tasaIsv', message: 'Seleccione una tasa de ISV válida.' });
  }
  const discountValue = Number(order.discountValue);
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    errors.push({ field: 'valorDescuento', message: 'El valor del descuento no es válido.' });
  } else if (order.discountType === 'PORCENTAJE' && discountValue > 100) {
    errors.push({
      field: 'valorDescuento',
      message: 'El descuento porcentual no puede superar el 100%.',
    });
  } else if (order.discountType === 'NINGUNO' && discountValue !== 0) {
    errors.push({
      field: 'valorDescuento',
      message: 'Una orden sin descuento debe tener valor cero.',
    });
  } else if (
    order.discountType === 'MONTO' &&
    order.discountValue.greaterThan(
      order.items.reduce((subtotal, item) => subtotal.add(item.quantity.mul(item.unitPrice)), new Prisma.Decimal(0))
    )
  ) {
    errors.push({
      field: 'valorDescuento',
      message: 'El descuento fijo no puede superar el subtotal.',
    });
  }

  return errors;
}
