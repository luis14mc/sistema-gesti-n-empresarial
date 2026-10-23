import { prisma } from '@/lib/prisma';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { maskLicenseKey } from '@/modules/software-licenses/domain/license-key';
import { findEmployeeActiveAssetsDetail } from '@/modules/people/infrastructure/employee-assets';
import {
  AUDIT_ACTION_EMPLOYEE_DISCHARGE_ACTA,
  RETURN_REASON_TERMINATION,
} from '@/modules/equipment/domain/acta-texts';
import { buildDischargeActaHtml } from '@/modules/equipment/infrastructure/acta-html';
import { resolveActaDeliverer } from '@/modules/equipment/infrastructure/acta-deliverer';
import { storeDischargeActaPdf } from '@/modules/equipment/infrastructure/acta-pdf-store';
import { returnAssignmentInTransaction } from '@/modules/equipment/infrastructure/equipment-repository';
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

export async function getDischargeActaPrefill(organizationId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    select: {
      id: true,
      fullName: true,
      dni: true,
      position: { select: { name: true } },
    },
  });
  if (!employee) return null;

  const assets = await findEmployeeActiveAssetsDetail(organizationId, employeeId);

  const activeAssignments = await prisma.equipmentAssignment.findMany({
    where: { employeeId, status: 'ACTIVE', equipment: { organizationId } },
    include: { equipment: { select: { type: true, brand: true, model: true, serialNumber: true, includedAccessories: true } } },
  });

  const licenseAssignments = await prisma.licenseAssignment.findMany({
    where: { employeeId, unassignedAt: null, seat: { subscription: { organizationId } } },
    include: {
      seat: {
        select: {
          seatType: true,
          accountEmail: true,
          accountIdentifier: true,
          licenseKey: true,
          subscription: { select: { product: { select: { name: true } } } },
        },
      },
    },
  });

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
  const records = await prisma.auditRecord.findMany({
    where: {
      organizationId,
      entityId: employeeId,
      action: AUDIT_ACTION_EMPLOYEE_DISCHARGE_ACTA,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      newData: true,
      description: true,
    },
  });

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

export async function generateDischargeActa(params: {
  organizationId: string;
  employeeId: string;
  actorUserId: string;
  input: DischargeActaFormInput;
}) {
  const employee = await prisma.employee.findFirst({
    where: { id: params.employeeId, organizationId: params.organizationId },
    select: { id: true, fullName: true, dni: true, position: { select: { name: true } } },
  });
  if (!employee) return { kind: 'not_found' as const };

  const terminationDate = new Date(params.input.terminationDate);
  if (Number.isNaN(terminationDate.getTime())) {
    return { kind: 'validation' as const, error: 'Fecha efectiva de terminación inválida' };
  }

  if (params.input.closeAssignmentsAndLicenses) {
    const activeAssignments = await prisma.equipmentAssignment.findMany({
      where: { employeeId: params.employeeId, status: 'ACTIVE', equipment: { organizationId: params.organizationId } },
      select: { id: true },
    });

    for (const assignment of activeAssignments) {
      await returnAssignmentInTransaction({
        organizationId: params.organizationId,
        assignmentId: assignment.id,
        returnedById: params.actorUserId,
        finalStatus: 'RETURNED',
        nextEquipmentStatus: 'AVAILABLE',
        returnReason: RETURN_REASON_TERMINATION,
        returnCondition: 'DEVUELTO',
        combinedReturnNotes: 'Devolución registrada desde acta de descargo por terminación laboral.',
      });
      try {
        await generateReturnActaPdf({
          organizationId: params.organizationId,
          assignmentId: assignment.id,
          actorUserId: params.actorUserId,
        });
      } catch (error) {
        console.error('DISCHARGE_RETURN_ACTA_FAILED', assignment.id, error);
      }
    }

    const licenseAssignments = await prisma.licenseAssignment.findMany({
      where: {
        employeeId: params.employeeId,
        unassignedAt: null,
        seat: { subscription: { organizationId: params.organizationId }, seatType: { in: ['INDIVIDUAL', 'SHARED'] } },
      },
      select: { id: true },
    });

    if (licenseAssignments.length > 0) {
      await prisma.licenseAssignment.updateMany({
        where: { id: { in: licenseAssignments.map((l) => l.id) } },
        data: { unassignedAt: new Date(), unassignedById: params.actorUserId },
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
    },
  });

  return { kind: 'ok' as const, url: stored.url, storageKey: stored.storageKey };
}
