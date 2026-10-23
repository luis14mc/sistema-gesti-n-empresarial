import type { Prisma } from '@prisma/client';
import { createLicenseStore } from '@/modules/software-licenses/infrastructure/license-repository';

export class LicenseAssignmentCloseError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'LicenseAssignmentCloseError';
  }
}

/** Cierra una asignación abierta INDIVIDUAL/SHARED dentro de una transacción existente (con auditoría). */
export async function closeLicenseAssignmentInTransaction(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    assignmentId: string;
    userId: string;
    reason: string;
  },
) {
  const assignment = await tx.licenseAssignment.findFirst({
    where: {
      id: params.assignmentId,
      unassignedAt: null,
      seat: {
        subscription: { organizationId: params.organizationId },
        seatType: { in: ['INDIVIDUAL', 'SHARED'] },
      },
    },
    include: {
      employee: { select: { fullName: true } },
      seat: { include: { subscription: { include: { product: true } } } },
    },
  });

  if (!assignment) {
    throw new LicenseAssignmentCloseError(
      'La asignación de licencia no existe o ya fue cerrada.',
      'LICENSE_ASSIGNMENT_NOT_FOUND',
    );
  }

  const store = createLicenseStore(tx, tx);
  await store.closeAssignment(assignment.id, params.userId);
  await store.audit({
    organizationId: params.organizationId,
    userId: params.userId,
    action: assignment.seat.seatType === 'SHARED' ? 'SHARED_ASSIGNMENT_REMOVED' : 'SEAT_UNASSIGNED',
    entityId: assignment.id,
    entityType: 'LicenseAssignment',
    title: 'Asignación cerrada',
    description: `${assignment.seat.subscription.product.name} · ${assignment.employee.fullName} · ${params.reason}`,
    newData: { reason: params.reason },
  });

  return assignment.id;
}
