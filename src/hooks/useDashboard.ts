'use client';

// ============================================
// HOOK useDashboard - React Query
// ============================================
// Agrega datos de múltiples módulos para el resumen
// del dashboard: conteos, actividad reciente, etc.

import { useQuery } from '@tanstack/react-query';
import { ticketsService } from '@/services/tickets.service';
import { oficiosService } from '@/services/oficios.service';
import { equipmentService } from '@/services/equipment.service';
import { timeEntriesService } from '@/services/time-entries.service';

// ============================================
// QUERY KEYS
// ============================================

export const dashboardKeys = {
    all: ['dashboard'] as const,
    summary: () => [...dashboardKeys.all, 'summary'] as const,
};

// ============================================
// TIPOS
// ============================================

export interface DashboardSummary {
    totalTickets: number;
    openTickets: number;
    totalOficios: number;
    totalEquipment: number;
    todayEntries: number;
    recentTickets: Array<{
        id: string;
        title: string;
        status: string;
        priority: string;
        createdAt: string;
        createdBy?: { firstName: string; lastName: string };
    }>;
    recentOficios: Array<{
        id: string;
        number: string;
        subject: string;
        status: string;
        createdAt: string;
    }>;
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useDashboard() {
    const summaryQuery = useQuery({
        queryKey: dashboardKeys.summary(),
        queryFn: async (): Promise<DashboardSummary> => {
            // Ejecutar todas las peticiones en paralelo
            const [ticketsRes, oficiosRes, equipmentRes, entriesRes] =
                await Promise.all([
                    ticketsService.list(),
                    oficiosService.list(),
                    equipmentService.list(),
                    timeEntriesService.list(),
                ]);

            const tickets = ticketsRes.data.tickets;
            const oficios = oficiosRes.data.oficios;
            const equipment = equipmentRes.data.equipment;
            const entries = entriesRes.data.timeEntries;

            // Contar tickets abiertos (no cerrados ni resueltos)
            const openTickets = tickets.filter(
                (t) => t.status !== 'CLOSED' && t.status !== 'RESOLVED'
            ).length;

            // Registros de hoy
            const today = new Date().toDateString();
            const todayEntries = entries.filter(
                (e) => new Date(e.timestamp).toDateString() === today
            ).length;

            return {
                totalTickets: tickets.length,
                openTickets,
                totalOficios: oficios.length,
                totalEquipment: equipment.length,
                todayEntries,
                recentTickets: tickets.slice(0, 5).map((t) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    createdAt: t.createdAt,
                    createdBy: t.createdBy,
                })),
                recentOficios: oficios.slice(0, 5).map((o) => ({
                    id: o.id,
                    number: o.number,
                    subject: o.subject,
                    status: o.status,
                    createdAt: o.createdAt,
                })),
            };
        },
        staleTime: 2 * 60 * 1000, // 2 minutos
    });

    return {
        summary: summaryQuery.data ?? null,
        isLoading: summaryQuery.isLoading,
        isError: summaryQuery.isError,
        error: summaryQuery.error,
        refetch: summaryQuery.refetch,
    };
}
