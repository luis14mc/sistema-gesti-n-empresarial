'use client';

// ============================================
// HOOK useDashboard - React Query
// ============================================
// Resumen de módulos activos del sistema.

import { useQuery } from '@tanstack/react-query';
import { oficiosService } from '@/services/oficios.service';
import { equipmentService } from '@/services/equipment.service';
import { purchasesService } from '@/services/purchases.service';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
};

export interface DashboardSummary {
  totalOficios: number;
  inProcessOficios: number;
  totalEquipment: number;
  availableEquipment: number;
  pendingPurchases: number;
  recentOficios: Array<{
    id: string;
    number: string;
    subject: string;
    status: string;
    type: string;
    createdAt: string;
  }>;
}

const IN_PROCESS_STATUSES = ['DRAFT', 'SENT', 'RECEIVED', 'IN_PROCESS'];

export function useDashboard() {
  const summaryQuery = useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: async (): Promise<DashboardSummary> => {
      const [oficiosRes, equipmentRes, purchasesRes] = await Promise.all([
        oficiosService.list({ pageSize: 20 }),
        equipmentService.list(),
        purchasesService.list(),
      ]);

      const oficios = oficiosRes.data.oficios;
      const equipment = equipmentRes.data.equipment;
      const purchases = purchasesRes.data.purchases;

      return {
        totalOficios: oficiosRes.data.total,
        inProcessOficios: oficios.filter((o) => IN_PROCESS_STATUSES.includes(o.status)).length,
        totalEquipment: equipment.length,
        availableEquipment: equipment.filter((e) => e.status === 'AVAILABLE').length,
        pendingPurchases: purchases.filter((p) => p.status === 'PENDING').length,
        recentOficios: oficios.slice(0, 5).map((o) => ({
          id: o.id,
          number: o.number,
          subject: o.subject,
          status: o.status,
          type: o.type,
          createdAt: o.createdAt,
        })),
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  return {
    summary: summaryQuery.data ?? null,
    isLoading: summaryQuery.isLoading,
    isError: summaryQuery.isError,
    error: summaryQuery.error,
    refetch: summaryQuery.refetch,
  };
}
