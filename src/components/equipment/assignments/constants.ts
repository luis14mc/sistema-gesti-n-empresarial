import { RETURN_REASON_OPTIONS } from '@/modules/equipment/domain/acta-texts';
import type { EquipmentStatus } from '@/types';

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activa',
  RETURNED: 'Devuelto',
  REPLACED: 'Reemplazado',
  CANCELLED: 'Cancelada',
};

export const ASSIGNMENT_STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900',
  RETURNED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
  REPLACED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
};

export const DELIVERY_REASONS = [
  'Nuevo ingreso',
  'Reemplazo de equipo',
  'Cambio de puesto',
  'Préstamo temporal',
  'Renovación tecnológica',
  'Otro',
];

export const RETURN_REASON_SELECT_VALUES = RETURN_REASON_OPTIONS.map((o) => o.value);

export const RETURN_CONDITIONS = [
  { value: 'BUENO', label: 'Bueno - Disponible', statusAfter: 'AVAILABLE' as EquipmentStatus },
  { value: 'MANTENIMIENTO', label: 'Requiere mantenimiento', statusAfter: 'IN_MAINTENANCE' as EquipmentStatus },
  { value: 'DANADO', label: 'Dañado', statusAfter: 'DAMAGED' as EquipmentStatus },
  { value: 'IRREPARABLE', label: 'Irreparable - Dar de baja', statusAfter: 'RETIRED' as EquipmentStatus },
];

export type AssignmentsTab = 'active' | 'history' | 'all';
