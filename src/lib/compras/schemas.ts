import { z } from 'zod';

export const COMPRA_TIPOS = ['BIENES', 'SERVICIOS', 'BIENES_SERVICIOS'] as const;
export const COMPRA_PRIORIDADES = ['URGENTE', 'ALTA', 'NORMAL', 'BAJA'] as const;
export const COMPRA_FORMAS_PAGO = ['CONTADO', 'CREDITO', 'ANTICIPO', 'CONTRA_ENTREGA'] as const;
export const COMPRA_UNIDADES = ['UNIDAD', 'CAJA', 'PAQUETE', 'SERVICIO', 'LOTE', 'MES', 'HORA', 'DIA'] as const;
export const COMPRA_TIPOS_ADJUNTO = [
  'COTIZACION',
  'FACTURA',
  'PROFORMA',
  'CORREO_AUTORIZACION',
  'SOPORTE_TECNICO',
  'OTRO',
] as const;

export const compraItemSchema = z.object({
  item: z.number().int().positive().optional(),
  codigo: z.string().optional(),
  descripcion: z.string().min(1, 'Descripción requerida'),
  unidad: z.enum(COMPRA_UNIDADES),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
  precioUnitario: z.number().min(0, 'Precio unitario inválido'),
});

export const createCompraSolicitudSchema = z.object({
  fechaSolicitud: z.string().optional(),
  fechaRequerida: z.string().min(1, 'Fecha requerida obligatoria'),
  departamentoSolicitanteId: z.string().min(1, 'Departamento obligatorio'),
  centroCostoId: z.string().min(1, 'Centro de costo obligatorio'),
  cargoSolicitante: z.string().optional(),
  tipoCompra: z.enum(COMPRA_TIPOS),
  prioridad: z.enum(COMPRA_PRIORIDADES),
  proveedorId: z.string().optional().nullable(),
  justificacionCompra: z.string().min(10, 'Justificación obligatoria'),
  condicionesEntrega: z.string().optional(),
  observacionesAdicionales: z.string().optional(),
  formaPago: z.enum(COMPRA_FORMAS_PAGO),
  plazoPagoDias: z.number().int().positive().optional().nullable(),
  detallesPago: z.string().optional(),
  descuento: z.number().min(0),
  items: z.array(compraItemSchema).min(1, 'Debe incluir al menos un ítem'),
});

export const updateCompraSolicitudSchema = createCompraSolicitudSchema.partial().extend({
  items: z.array(compraItemSchema).min(1).optional(),
});

export const createProveedorSchema = z.object({
  nombreRazonSocial: z.string().min(2, 'Nombre o razón social requerido'),
  rtn: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  personaContacto: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
});

export const workflowActionSchema = z.object({
  motivoRechazo: z.string().optional(),
  proveedorId: z.string().optional(),
});

export type CreateCompraSolicitudInput = z.infer<typeof createCompraSolicitudSchema>;
export type UpdateCompraSolicitudInput = z.infer<typeof updateCompraSolicitudSchema>;
export type CreateProveedorInput = z.infer<typeof createProveedorSchema>;
