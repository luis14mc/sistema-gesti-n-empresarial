import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import MainLayout from '@/components/layout/MainLayout';
import type { DashboardStats } from '@/types';
import { DashboardContent } from './_components/DashboardContent';

async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalTickets,
    openTickets,
    totalOficios,
    totalEquipment,
    availableEquipment,
    todayEntries,
    activeUsers,
    pendingPurchases,
  ] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.oficio.count(),
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
    prisma.timeEntry.count({ where: { date: { gte: today } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.purchaseRequest.count({ where: { status: 'PENDING' } }),
  ]);

  return {
    totalTickets,
    openTickets,
    totalOficios,
    totalEquipment,
    availableEquipment,
    todayEntries,
    activeUsers,
    pendingPurchases,
  };
}

export default async function DashboardPage() {
  const { user } = await requireSession();
  const stats = await getDashboardStats();

  return (
    <MainLayout user={user}>
      <DashboardContent stats={stats} userName={user.firstName} />
    </MainLayout>
  );
}
