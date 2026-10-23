import type { EquipmentAssignment } from '@prisma/client';
import { resolveActaDeliverer } from '@/modules/equipment/infrastructure/acta-deliverer';
import { resolveInstalledSoftwareLabel } from '@/modules/equipment/infrastructure/acta-equipment-software';
import {
  buildAssignmentActaHtml,
  buildReturnActaHtml,
} from '@/modules/equipment/infrastructure/acta-html';
import { storeEquipmentActaPdf } from '@/modules/equipment/infrastructure/acta-pdf-store';
import {
  findAssignmentWithRelations,
  updateAssignmentDocument,
  countAssignmentsForEquipment,
} from '@/modules/equipment/infrastructure/equipment-repository';
import type { ActaEquipmentSnapshot, ActaParty } from '@/modules/equipment/domain/acta-view-models';

type AssignmentRow = EquipmentAssignment & {
  employee?: {
    fullName: string;
    department: { name: string } | null;
    position: { name: string } | null;
  } | null;
};

function recipientFromAssignment(assignment: AssignmentRow): ActaParty {
  return {
    name: assignment.employeeNameSnapshot || assignment.employee?.fullName || '—',
    position: assignment.positionSnapshot || assignment.employee?.position?.name || '—',
    department: assignment.departmentSnapshot || assignment.employee?.department?.name || '—',
  };
}

async function equipmentSnapshotFromAssignment(
  organizationId: string,
  assignment: AssignmentRow,
  extras?: Pick<ActaEquipmentSnapshot, 'returnCondition' | 'returnNotes'>,
): Promise<ActaEquipmentSnapshot> {
  const softwareInstalled = await resolveInstalledSoftwareLabel(
    organizationId,
    assignment.equipmentId,
    assignment.softwareSnapshot,
  );
  return {
    brand: assignment.brandSnapshot,
    model: assignment.modelSnapshot,
    serialNumber: assignment.serialNumberSnapshot,
    inventoryNumber: assignment.inventoryNumberSnapshot,
    ram: assignment.ramSnapshot,
    processor: assignment.processorSnapshot,
    storage: assignment.storageSnapshot,
    operatingSystem: assignment.operatingSystemSnapshot,
    accessories: assignment.accessoriesSnapshot,
    softwareInstalled,
    returnCondition: extras?.returnCondition ?? null,
    returnNotes: extras?.returnNotes ?? null,
  };
}

async function deliveryStateForEquipment(equipmentId: string, assignmentId: string) {
  const total = await countAssignmentsForEquipment(equipmentId);
  return total <= 1 ? ('nuevo' as const) : ('en buen estado' as const);
}

export async function generateDeliveryActaPdf(params: {
  organizationId: string;
  assignmentId: string;
  actorUserId: string;
  documentDate?: Date;
}): Promise<{ url: string; storageKey: string }> {
  const assignment = await findAssignmentWithRelations(params.assignmentId, params.organizationId);
  if (!assignment) throw new Error('NOT_FOUND');

  const deliverer = await resolveActaDeliverer(params.actorUserId);
  const recipient = recipientFromAssignment(assignment);
  const equipment = await equipmentSnapshotFromAssignment(params.organizationId, assignment);
  const equipmentDeliveryState = await deliveryStateForEquipment(assignment.equipmentId, assignment.id);
  const documentDate = params.documentDate ?? assignment.assignedDate ?? new Date();

  const html = buildAssignmentActaHtml({
    documentDate,
    recipient,
    deliverer,
    equipment,
    equipmentDeliveryState,
  });

  const stored = await storeEquipmentActaPdf({
    organizationId: params.organizationId,
    tipo: 'ACTA_ASIGNACION',
    assignmentId: assignment.id,
    html,
    label: 'acta-asignacion',
  });

  await updateAssignmentDocument({
    organizationId: params.organizationId,
    assignmentId: assignment.id,
    updateData: { deliveryDocumentUrl: stored.url, urlNotaPdf: stored.url },
  });

  return stored;
}

export async function generateReturnActaPdf(params: {
  organizationId: string;
  assignmentId: string;
  actorUserId: string;
  documentDate?: Date;
}): Promise<{ url: string; storageKey: string }> {
  const assignment = await findAssignmentWithRelations(params.assignmentId, params.organizationId);
  if (!assignment) throw new Error('NOT_FOUND');

  const deliverer = await resolveActaDeliverer(params.actorUserId);
  const recipient = recipientFromAssignment(assignment);
  const equipment = await equipmentSnapshotFromAssignment(params.organizationId, assignment, {
    returnCondition: assignment.returnCondition,
    returnNotes: assignment.returnNotes,
  });
  const documentDate = params.documentDate ?? assignment.returnedDate ?? new Date();

  const html = buildReturnActaHtml({
    documentDate,
    recipient,
    deliverer,
    returnReason: assignment.returnReason,
    equipment,
  });

  const stored = await storeEquipmentActaPdf({
    organizationId: params.organizationId,
    tipo: 'ACTA_DEVOLUCION',
    assignmentId: assignment.id,
    html,
    label: 'acta-devolucion',
  });

  await updateAssignmentDocument({
    organizationId: params.organizationId,
    assignmentId: assignment.id,
    updateData: { returnDocumentUrl: stored.url },
  });

  return stored;
}

export async function previewAssignmentActaHtml(params: {
  organizationId: string;
  assignmentId: string;
  actorUserId: string;
  type: 'delivery' | 'return';
}): Promise<string> {
  const assignment = await findAssignmentWithRelations(params.assignmentId, params.organizationId);
  if (!assignment) throw new Error('NOT_FOUND');
  const deliverer = await resolveActaDeliverer(params.actorUserId);
  const recipient = recipientFromAssignment(assignment);
  const equipment = await equipmentSnapshotFromAssignment(params.organizationId, assignment, {
    returnCondition: assignment.returnCondition,
    returnNotes: assignment.returnNotes,
  });

  if (params.type === 'delivery') {
    const equipmentDeliveryState = await deliveryStateForEquipment(assignment.equipmentId, assignment.id);
    return buildAssignmentActaHtml({
      documentDate: assignment.assignedDate ?? new Date(),
      recipient,
      deliverer,
      equipment,
      equipmentDeliveryState,
    });
  }

  return buildReturnActaHtml({
    documentDate: assignment.returnedDate ?? new Date(),
    recipient,
    deliverer,
    returnReason: assignment.returnReason,
    equipment,
  });
}
