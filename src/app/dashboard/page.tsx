import { requireSession } from '@/platform/security/authentication/session';
import { getDashboardKpis } from '@/modules/dashboard/application/get-dashboard-kpis';
import MainLayout from '@/components/layout/MainLayout';
import { DashboardContent } from './_components/DashboardContent';

export default async function DashboardPage() {
  const { user } = await requireSession();
  const { stats, recentOficios } = await getDashboardKpis();

  return (
    <MainLayout user={user}>
      <DashboardContent
        stats={stats}
        userName={user.firstName}
        role={user.role}
        recentOficios={recentOficios}
      />
    </MainLayout>
  );
}
