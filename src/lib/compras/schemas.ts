import { z } from 'zod';

export const COMPRA_UNIDADES = ['UNIDAD', 'CAJA', 'PAQUETE', 'SERVICIO', 'LOTE', 'MES', 'HORA', 'DIA', 'OTRO'] as const;
export const COMPRA_TIPOS_ADJUNTO = ['COTIZACION', 'FACTURA', 'SOPORTE_TECNICO', 'OTRO'] as const;

export const compraItemSchema = z.object({
  item: z.number().int().positive().optional(),
  descripcion: z.string().min(1, 'Descripción requerida'),
  unidad: z.enum(COMPRA_UNIDADES),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
  precioUnitario: z.number().min(0).optional(),
});

export const borradorOrdenSchema = z.object({
  fechaSolicitud: z.string().optional(),
  fechaRequerida: z.string().optional(),
  referenciaCompra: z.string().optional(),
  cargoSolicitante: z.string().optional(),
  proveedorId: z.string().optional().nullable(),
  proveedorNombre: z.string().optional(),
  proveedorIdentificacion: z.string().optional().nullable(),
  proveedorTelefono: z.string().optional().nullable(),
  proveedorEmail: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  proveedorContacto: z.string().optional().nullable(),
  proveedorDireccion: z.string().optional().nullable(),
  justificacionCompra: z.string().optional(),
  observacionesAdicionales: z.string().optional(),
  descuento: z.number().min(0).optional(),
  items: z.array(compraItemSchema).optional(),
});

export const updateOrdenSchema = borradorOrdenSchema;

export function validarOrdenParaGenerar(data: {
  fechaRequerida?: Date | string | null;
  cargoSolicitante?: string | null;
  proveedorNombre?: string | null;
  proveedorIdentificacion?: string | null;
  proveedorTelefono?: string | null;
  justificacionCompra?: string | null;
  items?: Array<{ descripcion?: string; cantidad?: number; unidad?: string }>;
}): string[] {
  const errors: string[] = [];
  if (!data.fechaRequerida) errors.push('Fecha requerida obligatoria');
  if (!data.cargoSolicitante) errors.push('Cargo obligatorio');
  if (!data.proveedorNombre?.trim()) errors.push('Nombre del proveedor obligatorio');
  if (!data.proveedorIdentificacion?.trim()) errors.push('RTN del proveedor obligatorio');
  if (!data.proveedorTelefono?.trim()) errors.push('Teléfono del proveedor obligatorio');
  if (!data.justificacionCompra || data.justificacionCompra.length < 10) {
    errors.push('Justificación obligatoria (mín. 10 caracteres)');
  }
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

export type BorradorOrdenInput = z.infer<typeof borradorOrdenSchema>;
export type UpdateOrdenInput = z.infer<typeof updateOrdenSchema>;
export type CreateProveedorInput = z.infer<typeof createProveedorSchema>;

// Aliases legacy
export const borradorCompraSolicitudSchema = borradorOrdenSchema;
export const updateCompraSolicitudSchema = updateOrdenSchema;
export type BorradorCompraSolicitudInput = BorradorOrdenInput;
export type UpdateCompraSolicitudInput = UpdateOrdenInput;
