import { countDashboardStats, listRecentOficios } from '@/modules/dashboard/infrastructure/dashboard-kpi-queries';

export async function getDashboardKpis() {
  const [stats, recentOficios] = await Promise.all([
    countDashboardStats(),
    listRecentOficios(),
  ]);
  return { stats, recentOficios };
}
