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
