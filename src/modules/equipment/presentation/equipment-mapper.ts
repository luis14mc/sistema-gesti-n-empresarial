import type { Equipment, EquipmentAssignment, EquipmentHistory } from '@prisma/client';
import { CATEGORY_LABELS } from '@/modules/equipment/domain/equipment-asset-code';
import { toEquipmentDocumentHref, withStableEquipmentDocumentUrls } from '@/modules/equipment/infrastructure/equipment-document-access';

type EquipmentWithRelations = Equipment & {
  assignments?: (EquipmentAssignment & {
    user?: { id: string; firstName: string; lastName: string; email: string } | null;
    employee?: {
      id: string;
      fullName: string;
      email: string;
      department?: { name: string } | null;
      position?: { name: string } | null;
    } | null;
  })[];
  maintenances?: unknown[];
  history?: EquipmentHistory[];
};

export function mapEquipmentResponse(equipment: EquipmentWithRelations) {
  const activeAssignment = equipment.assignments?.find((a) => a.status === 'ACTIVE');

  return {
    ...equipment,
    ...(equipment.assignments
      ? { assignments: equipment.assignments.map((a) => withStableEquipmentDocumentUrls(a)) }
      : {}),
    code: equipment.inventoryCode,
    assetCode: equipment.inventoryCode,
    name: `${equipment.brand} ${equipment.model}`,
    categoryLabel: CATEGORY_LABELS[equipment.category],
    purchaseCost: equipment.cost != null ? equipment.cost.toString() : null,
    warrantyDate: equipment.warrantyDate,
    description: equipment.notes,
    assignedTo: activeAssignment
      ? activeAssignment.employeeNameAtTime ||
        (activeAssignment.employee
          ? activeAssignment.employee.fullName
          : activeAssignment.user
            ? `${activeAssignment.user.firstName} ${activeAssignment.user.lastName}`
            : null)
      : null,
    assignedDepartment:
      activeAssignment?.departmentAtTime ||
      activeAssignment?.employee?.department?.name ||
      null,
  };
}

export function mapAssignmentResponse(
  assignment: EquipmentAssignment & {
    equipment?: Equipment;
    user?: { id: string; firstName: string; lastName: string; email: string } | null;
    employee?: {
      id: string;
      fullName: string;
      email: string;
      department?: { name: string } | null;
      position?: { name: string } | null;
    } | null;
  }
) {
  const assigneeName =
    assignment.employeeNameSnapshot || assignment.employeeNameAtTime ||
    assignment.employee?.fullName ||
    (assignment.user ? `${assignment.user.firstName} ${assignment.user.lastName}` : null);

  const assigneeEmail =
    assignment.employeeEmailAtTime || assignment.employee?.email || assignment.user?.email || null;

  return {
    ...assignment,
    assigneeName,
    assigneeEmail,
    condition: assignment.returnCondition || null,
    urlNotaPdf: toEquipmentDocumentHref(assignment.urlNotaPdf),
    deliveryDocumentUrl: toEquipmentDocumentHref(assignment.deliveryDocumentUrl || assignment.urlNotaPdf),
    returnDocumentUrl: toEquipmentDocumentHref(assignment.returnDocumentUrl),
  };
}
