import { prisma } from '@/lib/prisma';

/** Returns total FK-backed references that block hard delete. */
export async function countBlockingUserReferences(userId: string): Promise<number> {
  const [
    auditRecords,
    institutionalAuditsCreated,
    oficiosCreated,
    oficiosUpdated,
    oficiosImported,
    oficioDocuments,
    oficioTracking,
    oficioImportBatches,
    equipmentAssignments,
    equipmentHistory,
    equipmentMaintenance,
    disposalEvaluated,
    disposalApproved,
    disposalDocuments,
    disposalHistory,
    compraOrdenesCreated,
    compraOrdenesGenerated,
    compraOrdenesIssued,
    compraOrdenHistorial,
    compraOrdenDocuments,
    compraSolicitudes,
    payslipsGenerated,
    correctiveActions,
    ticketsCreated,
    ticketsAssigned,
  ] = await Promise.all([
    prisma.auditRecord.count({ where: { userId } }),
    prisma.audit.count({ where: { OR: [{ createdById: userId }, { leadAuditorId: userId }] } }),
    prisma.oficio.count({ where: { createdById: userId } }),
    prisma.oficio.count({ where: { updatedById: userId } }),
    prisma.oficio.count({ where: { importedById: userId } }),
    prisma.oficioDocument.count({ where: { uploadedById: userId } }),
    prisma.oficioTracking.count({ where: { performedById: userId } }),
    prisma.oficioImportBatch.count({ where: { performedById: userId } }),
    prisma.equipmentAssignment.count({ where: { userId } }),
    prisma.equipmentHistory.count({ where: { performedById: userId } }),
    prisma.equipmentMaintenance.count({ where: { performedById: userId } }),
    prisma.equipmentDisposal.count({ where: { evaluatedById: userId } }),
    prisma.equipmentDisposal.count({ where: { approvedById: userId } }),
    prisma.disposalDocument.count({ where: { uploadedById: userId } }),
    prisma.equipmentDisposalHistory.count({ where: { performedById: userId } }),
    prisma.compraOrden.count({ where: { createdById: userId } }),
    prisma.compraOrden.count({ where: { generatedById: userId } }),
    prisma.compraOrden.count({ where: { issuedById: userId } }),
    prisma.compraOrdenHistorial.count({ where: { performedById: userId } }),
    prisma.compraOrdenDocumento.count({ where: { uploadedById: userId } }),
    prisma.compraSolicitud.count({ where: { solicitadoPorId: userId } }),
    prisma.payslip.count({ where: { generatedById: userId } }),
    prisma.correctiveAction.count({ where: { responsibleId: userId } }),
    prisma.ticket.count({ where: { createdById: userId } }),
    prisma.ticket.count({ where: { assignedToId: userId } }),
  ]);

  return (
    auditRecords +
    institutionalAuditsCreated +
    oficiosCreated +
    oficiosUpdated +
    oficiosImported +
    oficioDocuments +
    oficioTracking +
    oficioImportBatches +
    equipmentAssignments +
    equipmentHistory +
    equipmentMaintenance +
    disposalEvaluated +
    disposalApproved +
    disposalDocuments +
    disposalHistory +
    compraOrdenesCreated +
    compraOrdenesGenerated +
    compraOrdenesIssued +
    compraOrdenHistorial +
    compraOrdenDocuments +
    compraSolicitudes +
    payslipsGenerated +
    correctiveActions +
    ticketsCreated +
    ticketsAssigned
  );
}
