import { prisma } from '@/lib/prisma';
import type { DashboardStats, DashboardRecentOficio } from '@/types';

export async function countDashboardStats(): Promise<DashboardStats> {
  const [
    totalOficios,
    inProcessOficios,
    totalEquipment,
    availableEquipment,
    activeAssignments,
    pendingPurchases,
    activeUsers,
  ] = await Promise.all([
    prisma.oficio.count(),
    prisma.oficio.count({
      where: { status: { in: ['DRAFT', 'SENT', 'RECEIVED', 'IN_PROCESS'] } },
    }),
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
    prisma.equipmentAssignment.count({ where: { status: 'ACTIVE' } }),
    // Phase 13 · C-1 remediation: purchasing KPIs must read the canonical
    // purchase-order aggregate (`CompraOrden` → purchase_orders), the same
    // records the operational UI creates — not the legacy `CompraSolicitud`.
    // See docs/remediation/procurement-canonicalization.md.
    prisma.compraOrden.count({
      where: {
        status: { in: ['DRAFT', 'GENERATED'] },
        deletedAt: null,
      },
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return {
    totalOficios,
    inProcessOficios,
    totalEquipment,
    availableEquipment,
    activeAssignments,
    pendingPurchases,
    activeUsers,
  };
}

export async function listRecentOficios(): Promise<DashboardRecentOficio[]> {
  return prisma.oficio.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      number: true,
      subject: true,
      status: true,
      type: true,
      createdAt: true,
    },
  });
}
