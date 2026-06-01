'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent } from '@/components/ui/card';
import {
  Ticket,
  FileText,
  Monitor,
  Clock,
  Users,
  Package,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import type { DashboardStats } from '@/types';

const QUICK_ACTIONS = [
  {
    title: 'Tickets de Soporte',
    description: 'Gestiona tickets y solicitudes',
    icon: Ticket,
    href: '/tickets',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  {
    title: 'Oficios',
    description: 'Registro y seguimiento de oficios',
    icon: FileText,
    href: '/oficios',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    title: 'Equipos',
    description: 'Control de inventario IT',
    icon: Monitor,
    href: '/equipment',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    title: 'Inv. Promocional',
    description: 'Stock y movimientos',
    icon: Package,
    href: '/inventory',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    title: 'Asistencia',
    description: 'Marcado de entrada/salida',
    icon: Clock,
    href: '/time-entries',
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  {
    title: 'Usuarios',
    description: 'Gestión de cuentas',
    icon: Users,
    href: '/users',
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
] as const;

interface DashboardContentProps {
  stats: DashboardStats;
  userName: string;
}

export function DashboardContent({ stats, userName }: DashboardContentProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={`Hola, ${userName} 👋`}
        description="Resumen general de tu sistema de gestión"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Tickets"
          value={stats.totalTickets}
          subtitle={`${stats.openTickets} abiertos`}
          icon={Ticket}
          variant="primary"
        />
        <StatsCard
          title="Oficios"
          value={stats.totalOficios}
          subtitle="Registro de oficios"
          icon={FileText}
        />
        <StatsCard
          title="Equipos"
          value={stats.totalEquipment}
          subtitle={`${stats.availableEquipment} disponibles`}
          icon={Monitor}
        />
        <StatsCard
          title="Asistencia Hoy"
          value={stats.todayEntries}
          subtitle={`${stats.activeUsers} usuarios activos`}
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary/30 group cursor-pointer">
              <CardContent className="p-5 flex items-start gap-4">
                <div
                  className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${action.color}`}
                >
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm font-heading">
                    {action.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
