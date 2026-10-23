import { CATEGORY_LABELS } from '@/modules/equipment/domain/equipment-asset-code';
import type { EquipmentAssignment } from '@/types';
import { Laptop, Monitor, Printer, Server, Smartphone, type LucideIcon } from 'lucide-react';

export function getAssigneeName(a: EquipmentAssignment): string {
  return (
    a.assigneeName ||
    a.employeeNameSnapshot ||
    a.employeeNameAtTime ||
    a.employee?.fullName ||
    (a.user ? `${a.user.firstName} ${a.user.lastName}` : '—')
  );
}

export function getDepartmentLine(a: EquipmentAssignment): string {
  const department = a.departmentSnapshot ?? a.departmentAtTime ?? a.employee?.department?.name ?? '—';
  const position = a.positionSnapshot ?? a.positionAtTime ?? a.employee?.position?.name ?? '—';
  return `${department} · ${position}`;
}

export function getEquipmentBrandModel(a: EquipmentAssignment): string {
  const brand = a.brandSnapshot ?? a.equipment?.brand ?? '';
  const model = a.modelSnapshot ?? a.equipment?.model ?? '';
  return `${brand} ${model}`.trim() || '—';
}

export function getInventoryCode(a: EquipmentAssignment): string {
  return a.inventoryNumberSnapshot ?? a.equipment?.inventoryCode ?? a.equipment?.code ?? '—';
}

export function getSerialNumber(a: EquipmentAssignment): string {
  return a.serialNumberSnapshot ?? a.equipment?.serialNumber ?? '—';
}

export function equipmentCategoryIcon(category?: string | null): LucideIcon {
  switch (category) {
    case 'LAPTOP':
      return Laptop;
    case 'DESKTOP_PC':
      return Monitor;
    case 'MOBILE':
      return Smartphone;
    case 'SERVER':
      return Server;
    case 'PRINTER':
      return Printer;
    default:
      return Monitor;
  }
}

export function equipmentTypeLabel(a: EquipmentAssignment): string {
  const category = a.equipment?.category;
  if (category && category in CATEGORY_LABELS) {
    return CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];
  }
  return a.equipment?.type ?? 'Equipo';
}

export function actaDownloadUrl(assignmentId: string, type: 'delivery' | 'return'): string {
  return `/api/equipment-assignments/${assignmentId}/acta?type=${type}`;
}

export function getAssigneeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export type ParsedLegacyDeliveryNotes = {
  condition: string | null;
  accessories: string | null;
  remainingNotes: string | null;
};

/** Notas antiguas con "Condición de entrega:" y "Accesorios:" en el mismo texto. */
export function parseLegacyDeliveryNotes(raw: string | null | undefined): ParsedLegacyDeliveryNotes {
  if (!raw?.trim()) {
    return { condition: null, accessories: null, remainingNotes: null };
  }

  const text = raw.trim();
  const hasLegacyMarkers = /Condici[oó]n de entrega:/i.test(text) || /Accesorios:/i.test(text);
  if (!hasLegacyMarkers) {
    return { condition: null, accessories: null, remainingNotes: text };
  }

  let condition: string | null = null;
  let accessories: string | null = null;
  let remaining = text;

  const conditionMatch = text.match(/Condici[oó]n de entrega:\s*([\s\S]*?)(?=Accesorios:|$)/i);
  if (conditionMatch?.[1]?.trim()) {
    condition = conditionMatch[1].trim();
    remaining = remaining.replace(conditionMatch[0], '').trim();
  }

  const accessoriesMatch = text.match(/Accesorios:\s*([\s\S]*?)(?=Condici[oó]n de entrega:|$)/i);
  if (accessoriesMatch?.[1]?.trim()) {
    accessories = accessoriesMatch[1].trim();
    remaining = remaining.replace(accessoriesMatch[0], '').trim();
  }

  return {
    condition,
    accessories,
    remainingNotes: remaining || null,
  };
}

export function assignmentsListHref(queryString: string): string {
  return queryString ? `/activos/asignaciones?${queryString}` : '/activos/asignaciones';
}
