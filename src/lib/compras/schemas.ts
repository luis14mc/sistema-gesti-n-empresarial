import { z } from 'zod';

export const COMPRA_TIPOS = ['BIENES', 'SERVICIOS', 'BIENES_SERVICIOS'] as const;
export const COMPRA_PRIORIDADES = ['URGENTE', 'ALTA', 'NORMAL', 'BAJA'] as const;
export const COMPRA_FORMAS_PAGO = ['CONTADO', 'CREDITO', 'ANTICIPO', 'CONTRA_ENTREGA'] as const;
export const COMPRA_UNIDADES = ['UNIDAD', 'CAJA', 'PAQUETE', 'SERVICIO', 'LOTE', 'MES', 'HORA', 'DIA'] as const;

export const compraItemSchema = z.object({
  item: z.number().int().positive().optional(),
  codigo: z.string().optional(),
  descripcion: z.string().min(1, 'Descripción requerida'),
  unidad: z.enum(COMPRA_UNIDADES),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
  precioUnitario: z.number().min(0).optional(),
});

export const borradorCompraSolicitudSchema = z.object({
  fechaSolicitud: z.string().optional(),
  fechaRequerida: z.string().optional(),
  departamentoSolicitanteId: z.string().optional(),
  centroCostoId: z.string().optional(),
  cargoSolicitante: z.string().optional(),
  tipoCompra: z.enum(COMPRA_TIPOS).optional(),
  prioridad: z.enum(COMPRA_PRIORIDADES).optional(),
  proveedorId: z.string().optional().nullable(),
  proveedorNombre: z.string().optional(),
  proveedorIdentificacion: z.string().optional().nullable(),
  proveedorTelefono: z.string().optional().nullable(),
  proveedorEmail: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  proveedorContacto: z.string().optional().nullable(),
  proveedorDireccion: z.string().optional().nullable(),
  justificacionCompra: z.string().optional(),
  condicionesEntrega: z.string().optional(),
  observacionesAdicionales: z.string().optional(),
  formaPago: z.enum(COMPRA_FORMAS_PAGO).optional(),
  plazoPagoDias: z.number().int().positive().optional().nullable(),
  detallesPago: z.string().optional(),
  descuento: z.number().min(0).optional(),
  items: z.array(compraItemSchema).optional(),
});

export const createCompraSolicitudSchema = z.object({
  fechaSolicitud: z.string().optional(),
  fechaRequerida: z.string().min(1, 'Fecha requerida obligatoria'),
  departamentoSolicitanteId: z.string().min(1, 'Departamento obligatorio'),
  centroCostoId: z.string().min(1, 'Centro de costo obligatorio'),
  cargoSolicitante: z.string().min(1, 'Cargo obligatorio'),
  tipoCompra: z.enum(COMPRA_TIPOS),
  prioridad: z.enum(COMPRA_PRIORIDADES),
  proveedorId: z.string().optional().nullable(),
  proveedorNombre: z.string().min(2, 'Nombre del proveedor obligatorio'),
  proveedorIdentificacion: z.string().optional().nullable(),
  proveedorTelefono: z.string().optional().nullable(),
  proveedorEmail: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  proveedorContacto: z.string().optional().nullable(),
  proveedorDireccion: z.string().optional().nullable(),
  justificacionCompra: z.string().min(10, 'Justificación obligatoria'),
  condicionesEntrega: z.string().optional(),
  observacionesAdicionales: z.string().optional(),
  formaPago: z.enum(COMPRA_FORMAS_PAGO),
  plazoPagoDias: z.number().int().positive().optional().nullable(),
  detallesPago: z.string().optional(),
  descuento: z.number().min(0).optional(),
  items: z.array(compraItemSchema).min(1, 'Debe incluir al menos un ítem'),
});

export const updateCompraSolicitudSchema = borradorCompraSolicitudSchema;

export function validarCompraParaEnviar(data: {
  fechaRequerida?: Date | string | null;
  departamentoSolicitanteId?: string | null;
  cargoSolicitante?: string | null;
  tipoCompra?: string;
  prioridad?: string;
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  justificacionCompra?: string | null;
  formaPago?: string | null;
  items?: Array<{ descripcion?: string; cantidad?: number; unidad?: string }>;
}): string[] {
  const errors: string[] = [];
  if (!data.fechaRequerida) errors.push('Fecha requerida obligatoria');
  if (!data.departamentoSolicitanteId) errors.push('Departamento obligatorio');
  if (!data.cargoSolicitante) errors.push('Cargo obligatorio');
  if (!data.tipoCompra) errors.push('Tipo de compra obligatorio');
  if (!data.prioridad) errors.push('Prioridad obligatoria');
  if (!data.proveedorId && !data.proveedorNombre) errors.push('Proveedor obligatorio');
  if (!data.justificacionCompra || data.justificacionCompra.length < 10) {
    errors.push('Justificación obligatoria (mín. 10 caracteres)');
  }
  if (!data.formaPago) errors.push('Forma de pago obligatoria');
  if (!data.items?.length) errors.push('Debe incluir al menos un ítem');
  else {
    data.items.forEach((item, i) => {
      if (!item.descripcion) errors.push(`Ítem ${i + 1}: descripción obligatoria`);
      if (!item.cantidad || item.cantidad <= 0) errors.push(`Ítem ${i + 1}: cantidad obligatoria`);
      if (!item.unidad) errors.push(`Ítem ${i + 1}: unidad obligatoria`);
    });
  }
  return errors;
}

export const createProveedorSchema = z.object({
  nombreRazonSocial: z.string().min(2),
  rtn: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  personaContacto: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
});

export const rechazarSolicitudSchema = z.object({
  motivoRechazo: z.string().min(5, 'Motivo de rechazo obligatorio'),
});

export type BorradorCompraSolicitudInput = z.infer<typeof borradorCompraSolicitudSchema>;
export type CreateCompraSolicitudInput = z.infer<typeof createCompraSolicitudSchema>;
export type UpdateCompraSolicitudInput = z.infer<typeof updateCompraSolicitudSchema>;
export type CreateProveedorInput = z.infer<typeof createProveedorSchema>;
