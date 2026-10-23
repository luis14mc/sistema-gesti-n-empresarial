import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { maskLicenseKey } from '@/modules/software-licenses/domain/license-key';
import {
  AUDIT_ACTION_EMPLOYEE_DISCHARGE_ACTA,
  RETURN_REASON_TERMINATION,
} from '@/modules/equipment/domain/acta-texts';
import { buildDischargeActaHtml } from '@/modules/equipment/infrastructure/acta-html';
import { resolveActaDeliverer } from '@/modules/equipment/infrastructure/acta-deliverer';
import { storeDischargeActaPdf } from '@/modules/equipment/infrastructure/acta-pdf-store';
import {
  closeEmployeeAssetsForDischargeInTransaction,
  DischargeAssetClosureError,
  findEmployeeForDischargeActa,
  listActiveEquipmentAssignmentsForDischarge,
  listDischargeActaAuditRecords,
  listLicenseAssignmentsForDischargePrefill,
} from '@/modules/equipment/infrastructure/discharge-acta-repository';
import { generateReturnActaPdf } from '@/modules/equipment/application/acta-generation';
import type { DischargeActaViewModel } from '@/modules/equipment/domain/acta-view-models';

export type DischargeActaFormInput = {
  terminationDate: string;
  dni: string;
  position: string;
  closeAssignmentsAndLicenses: boolean;
  equipmentRows: Array<{ item: string; brandModel: string; serial: string; notes: string }>;
  accessoryRows: Array<{ item: string; quantity: string; state: string; notes: string }>;
  licenseRows: Array<{ software: string; licenseNumber: string; notes: string }>;
  accessRows: Array<{ system: string; status: string; notes: string }>;
  miscRows: Array<{ item: string; state: string; notes: string }>;
};

export type DischargeActaPdfWarning = {
  assignmentId: string;
  mensaje: string;
};

export async function getDischargeActaPrefill(organizationId: string, employeeId: string) {
  const employee = await findEmployeeForDischargeActa(organizationId, employeeId);
  if (!employee) return null;

  const activeAssignments = await listActiveEquipmentAssignmentsForDischarge(organizationId, employeeId);
  const licenseAssignments = await listLicenseAssignmentsForDischargePrefill(organizationId, employeeId);

  const equipmentRows = activeAssignments.map((row) => ({
    item: row.equipment.type,
    brandModel: [row.equipment.brand, row.equipment.model].filter(Boolean).join(' ') || '—',
    serial: row.equipment.serialNumber ?? '',
    notes: '',
  }));

  const accessorySuggestions = activeAssignments
    .flatMap((row) => (row.equipment.includedAccessories ?? '').split(/[,;\n]+/))
    .map((s) => s.trim())
    .filter(Boolean);

  const licenseRows = licenseAssignments.map((row) => {
    const seat = row.seat;
    const account = seat.accountEmail ?? seat.accountIdentifier ?? '—';
    const licenseNumber =
      seat.seatType === 'DEVICE' ? maskLicenseKey(seat.licenseKey) ?? account : account;
    return {
      software: seat.subscription.product.name,
      licenseNumber: licenseNumber ?? '—',
      notes: '',
    };
  });

  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      dni: employee.dni ?? '',
      position: employee.position?.name ?? '',
    },
    equipmentRows,
    accessorySuggestions: [...new Set(accessorySuggestions)],
    licenseRows,
  };
}

export async function listDischargeActasForEmployee(organizationId: string, employeeId: string) {
  const records = await listDischargeActaAuditRecords(organizationId, employeeId);

  return records.map((row) => {
    const data = row.newData as { storageKey?: string; url?: string; summary?: unknown } | null;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      storageKey: data?.storageKey ?? null,
      url: data?.url ?? null,
      description: row.description,
    };
  });
}

function pdfErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Error desconocido al generar el PDF';
}

export async function generateDischargeActa(params: {
  organizationId: string;
  employeeId: string;
  actorUserId: string;
  input: DischargeActaFormInput;
}) {
  const employee = await findEmployeeForDischargeActa(params.organizationId, params.employeeId);
  if (!employee) return { kind: 'not_found' as const };

  const terminationDate = new Date(params.input.terminationDate);
  if (Number.isNaN(terminationDate.getTime())) {
    return { kind: 'validation' as const, error: 'Fecha efectiva de terminación inválida' };
  }

  let closedEquipmentAssignmentIds: string[] = [];

  if (params.input.closeAssignmentsAndLicenses) {
    try {
      const closure = await closeEmployeeAssetsForDischargeInTransaction({
        organizationId: params.organizationId,
        employeeId: params.employeeId,
        actorUserId: params.actorUserId,
        returnReason: RETURN_REASON_TERMINATION,
        returnNotes: 'Devolución registrada desde acta de descargo por terminación laboral.',
      });
      closedEquipmentAssignmentIds = closure.closedEquipmentAssignmentIds;
    } catch (error) {
      if (error instanceof DischargeAssetClosureError) {
        return { kind: 'closure_failed' as const, error: error.message };
      }
      throw error;
    }
  }

  const warnings: DischargeActaPdfWarning[] = [];

  for (const assignmentId of closedEquipmentAssignmentIds) {
    try {
      await generateReturnActaPdf({
        organizationId: params.organizationId,
        assignmentId,
        actorUserId: params.actorUserId,
      });
    } catch (error) {
      warnings.push({
        assignmentId,
        mensaje: `La devolución se registró, pero no se pudo generar el acta (${pdfErrorMessage(error)}). Use Regenerar acta.`,
      });
    }
  }

  const deliverer = await resolveActaDeliverer(params.actorUserId);
  const documentDate = new Date();

  const viewModel: DischargeActaViewModel = {
    documentDate,
    terminationDate,
    workerName: employee.fullName,
    workerDni: params.input.dni.trim() || employee.dni || '—',
    workerPosition: params.input.position.trim() || employee.position?.name || '—',
    deliverer,
    equipmentRows: params.input.equipmentRows.map((r) => ({
      Ítem: r.item,
      'Marca/Modelo': r.brandModel,
      Serie: r.serial,
      Observaciones: r.notes,
    })),
    accessoryRows: params.input.accessoryRows.map((r) => ({
      Ítem: r.item,
      Cantidad: r.quantity,
      Estado: r.state,
      Observaciones: r.notes,
    })),
    licenseRows: params.input.licenseRows.map((r) => ({
      Software: r.software,
      'N.º de licencia': r.licenseNumber,
      Observaciones: r.notes,
    })),
    accessRows: params.input.accessRows.map((r) => ({
      'Sistema/Acceso': r.system,
      'Entregado/Revocado': r.status,
      Observaciones: r.notes,
    })),
    miscRows: params.input.miscRows.map((r) => ({
      Ítem: r.item,
      Estado: r.state,
      Observaciones: r.notes,
    })),
  };

  const html = buildDischargeActaHtml(viewModel);
  const stored = await storeDischargeActaPdf({
    organizationId: params.organizationId,
    employeeId: params.employeeId,
    html,
  });

  const summary = {
    equipmentCount: params.input.equipmentRows.length,
    accessoryCount: params.input.accessoryRows.length,
    licenseCount: params.input.licenseRows.length,
    accessCount: params.input.accessRows.length,
    miscCount: params.input.miscRows.length,
    closedAssignments: params.input.closeAssignmentsAndLicenses,
    closedEquipmentAssignmentIds,
  };

  await createAuditRecord({
    organizationId: params.organizationId,
    userId: params.actorUserId,
    module: 'EQUIPOS',
    category: 'CREATE',
    action: AUDIT_ACTION_EMPLOYEE_DISCHARGE_ACTA,
    title: 'Acta de descargo por terminación laboral',
    description: `Acta de descargo generada para ${employee.fullName}`,
    entityId: params.employeeId,
    entityType: 'Employee',
    newData: {
      storageKey: stored.storageKey,
      url: stored.url,
      employeeId: params.employeeId,
      summary,
      terminationDate: terminationDate.toISOString(),
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  });

  return {
    kind: 'ok' as const,
    url: stored.url,
    storageKey: stored.storageKey,
    warnings,
  };
}
