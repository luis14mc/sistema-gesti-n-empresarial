// Constantes globales de la aplicación

export const APP_NAME = 'Sistema de Gestión Empresarial';
export const APP_VERSION = '1.0.0';

// API Base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Roles de usuario
export const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  RRHH: 'RRHH',
  IT: 'IT',
} as const;

// Estados de tickets
export const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

// Prioridades de tickets
export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

// Categorías de tickets
export const TICKET_CATEGORY = {
  HARDWARE: 'HARDWARE',
  SOFTWARE: 'SOFTWARE',
  NETWORK: 'NETWORK',
  ACCESS: 'ACCESS',
  OTHER: 'OTHER',
} as const;

// Estados de oficios
export const OFICIO_STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  RECEIVED: 'RECEIVED',
  IN_PROCESS: 'IN_PROCESS',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

// Tipos de oficios
export const OFICIO_TYPE = {
  INCOMING: 'INCOMING',
  OUTGOING: 'OUTGOING',
  INTERNAL: 'INTERNAL',
} as const;

// Tipos de entrada de tiempo
export const ENTRY_TYPE = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  BREAK_START: 'BREAK_START',
  BREAK_END: 'BREAK_END',
} as const;

// Estados de equipos
export const EQUIPMENT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  IN_MAINTENANCE: 'IN_MAINTENANCE',
  DAMAGED: 'DAMAGED',
  RETIRED: 'RETIRED',
} as const;

// Tipos de equipos
export const EQUIPMENT_TYPE = {
  LAPTOP: 'LAPTOP',
  DESKTOP: 'DESKTOP',
  MONITOR: 'MONITOR',
  PRINTER: 'PRINTER',
  PHONE: 'PHONE',
  TABLET: 'TABLET',
  ACCESSORY: 'ACCESSORY',
  OTHER: 'OTHER',
} as const;

// Estados de inventario promocional
export const PROMOTIONAL_STATUS = {
  IN_STOCK: 'IN_STOCK',
  OUT_FOR_EVENT: 'OUT_FOR_EVENT',
  DAMAGED: 'DAMAGED',
  LOST: 'LOST',
} as const;

// Tipos de movimiento
export const MOVEMENT_TYPE = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

// Configuración de paginación
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

// Colores para badges (dark-first)
export const BADGE_COLORS = {
  // Estados de tickets
  OPEN: 'bg-blue-500/10 text-blue-400',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-400',
  RESOLVED: 'bg-emerald-500/10 text-emerald-400',
  CLOSED: 'bg-slate-700 text-slate-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  
  // Prioridades
  LOW: 'bg-slate-700 text-slate-400',
  MEDIUM: 'bg-blue-500/10 text-blue-400',
  HIGH: 'bg-orange-500/10 text-orange-400',
  URGENT: 'bg-red-500/10 text-red-400',
  
  // Estados de equipos
  AVAILABLE: 'bg-emerald-500/10 text-emerald-400',
  ASSIGNED: 'bg-blue-500/10 text-blue-400',
  IN_MAINTENANCE: 'bg-amber-500/10 text-amber-400',
  DAMAGED: 'bg-red-500/10 text-red-400',
  RETIRED: 'bg-slate-700 text-slate-400',
} as const;

// Traducciones de estados (español)
export const TRANSLATIONS = {
  // Roles
  ADMIN: 'Administrador',
  USER: 'Usuario',
  RRHH: 'Recursos Humanos',
  IT: 'Sistemas / TI',
  
  // Estados de tickets
  OPEN: 'Abierto',
  IN_PROGRESS: 'En Proceso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado',
  
  // Prioridades
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
  
  // Categorías
  HARDWARE: 'Hardware',
  SOFTWARE: 'Software',
  NETWORK: 'Red',
  ACCESS: 'Acceso',
  OTHER: 'Otro',
  
  // Estados de oficios
  DRAFT: 'Borrador',
  SENT: 'Enviado',
  RECEIVED: 'Recibido',
  IN_PROCESS: 'En Proceso',
  COMPLETED: 'Completado',
  ARCHIVED: 'Archivado',
  
  // Tipos de oficios
  INCOMING: 'Entrante',
  OUTGOING: 'Saliente',
  INTERNAL: 'Interno',
  
  // Tipos de entrada
  CHECK_IN: 'Entrada',
  CHECK_OUT: 'Salida',
  BREAK_START: 'Inicio de Pausa',
  BREAK_END: 'Fin de Pausa',
  
  // Estados de equipos
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  IN_MAINTENANCE: 'En Mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Retirado',
  
  // Tipos de equipos
  LAPTOP: 'Laptop',
  DESKTOP: 'Computadora de Escritorio',
  MONITOR: 'Monitor',
  PRINTER: 'Impresora',
  PHONE: 'Teléfono',
  TABLET: 'Tablet',
  ACCESSORY: 'Accesorio',
  
  // Estados de inventario
  IN_STOCK: 'En Stock',
  OUT_FOR_EVENT: 'Fuera por Evento',
  LOST: 'Perdido',
  
  // Tipos de movimiento
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  RETURN: 'Retorno',
  ADJUSTMENT: 'Ajuste',
} as const;
