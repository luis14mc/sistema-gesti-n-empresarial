import { z } from 'zod';

// ============================================
// ZOD SCHEMAS — Mirror de los modelos Prisma
// ============================================

// ── Auth ──────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  employeeNumber: z.string().min(1, 'Número de empleado requerido'),
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// ── Tickets ───────────────────────────────────────────────────

export const TICKET_TYPES = ['HARDWARE', 'SOFTWARE', 'RED', 'ACCESO', 'OTRO'] as const;

export const createTicketSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().min(10, 'Mínimo 10 caracteres'),
  type: z.string().min(1, 'Tipo requerido'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignedToId: z.string().optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = createTicketSchema.partial().extend({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

// ── Oficios ───────────────────────────────────────────────────

export const createOficioSchema = z.object({
  number: z.string().min(1, 'Número de oficio requerido'),
  type: z.enum(['INCOMING', 'OUTGOING', 'INTERNAL_MEMO']),
  subject: z.string().min(3, 'Asunto requerido'),
  oficioDate: z.string().min(1, 'Fecha del oficio requerida'),
  comments: z.string().optional(),
});
export type CreateOficioInput = z.infer<typeof createOficioSchema>;

// ── Asistencia ────────────────────────────────────────────────

export const timeEntrySchema = z.object({
  latitude: z.number({ error: 'Ubicación requerida: activa el GPS' }),
  longitude: z.number({ error: 'Ubicación requerida: activa el GPS' }),
  notes: z.string().optional(),
});
export type TimeEntryInput = z.infer<typeof timeEntrySchema>;

// ── Equipos ───────────────────────────────────────────────────

export const EQUIPMENT_TYPES = ['LAPTOP', 'DESKTOP', 'PRINTER', 'MONITOR', 'TELEFONO', 'TABLET', 'ACCESORIO', 'OTRO'] as const;

export const createEquipmentSchema = z.object({
  inventoryCode: z.string().min(1, 'Código de inventario requerido'),
  type: z.string().min(1, 'Tipo requerido'),
  brand: z.string().min(1, 'Marca requerida'),
  model: z.string().min(1, 'Modelo requerido'),
  serialNumber: z.string().min(1, 'Número de serie requerido'),
  purchaseDate: z.string().min(1, 'Fecha de compra requerida'),
  warrantyDate: z.string().optional(),
  depreciationDate: z.string().optional(),
  // Hardware specs (condicionales en la UI para LAPTOP/DESKTOP)
  ram: z.string().optional(),
  processor: z.string().optional(),
  storage: z.string().optional(),
  os: z.string().optional(),
});
export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;

// ── Asignación de Equipos ─────────────────────────────────────

export const createAssignmentSchema = z.object({
  equipmentId: z.string().min(1, 'Equipo requerido'),
  userId: z.string().min(1, 'Usuario requerido'),
  notes: z.string().optional(),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

// ── Inventario Promocional ────────────────────────────────────

export const createPromotionalItemSchema = z.object({
  inventoryCode: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  quantity: z.coerce.number().int().min(0, 'Cantidad no puede ser negativa'),
  unitPrice: z.coerce.number().min(0, 'Precio no puede ser negativo'),
  purchaseDate: z.string().min(1, 'Fecha de compra requerida'),
});
export type CreatePromotionalItemInput = z.infer<typeof createPromotionalItemSchema>;

export const createMovementSchema = z.object({
  itemId: z.string().min(1, 'Artículo requerido'),
  type: z.enum(['EXIT', 'RETURN']),
  quantityOut: z.coerce.number().int().min(1, 'Mínimo 1 unidad'),
  quantityReturn: z.coerce.number().int().min(0).optional(),
  movementDate: z.string().min(1, 'Fecha requerida'),
  returnDate: z.string().optional(),
  eventName: z.string().optional(),
  eventLocation: z.string().optional(),
  eventDate: z.string().optional(),
  responsible: z.string().optional(),
  comments: z.string().optional(),
});
export type CreateMovementInput = z.infer<typeof createMovementSchema>;

// ── Compras ───────────────────────────────────────────────────

export const PURCHASE_CATEGORIES = [
  'EQUIPO_COMPUTO', 'SUMINISTROS', 'MOBILIARIO',
  'LICENCIAS', 'SERVICIOS', 'OTRO',
] as const;

export const PURCHASE_PRIORITIES = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'] as const;

export const createPurchaseSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().min(10, 'Mínimo 10 caracteres'),
  justification: z.string().min(10, 'Justificación requerida'),
  category: z.string().min(1, 'Categoría requerida'),
  priority: z.string().min(1, 'Prioridad requerida'),
});
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

// ── Usuarios ──────────────────────────────────────────────────

export const createUserSchema = z.object({
  employeeNumber: z.string().min(1, 'Número de empleado requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'USER', 'RRHH', 'IT']),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
