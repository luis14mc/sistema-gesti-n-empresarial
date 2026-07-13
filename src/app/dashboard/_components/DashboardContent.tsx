'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Monitor,
  ClipboardList,
  ShoppingCart,
  Users,
  ClipboardCheck,
  Settings,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { hasModuleAccess, type Module } from '@/lib/permissions';
import { formatRelativeDate } from '@/utils/helpers';
import type { DashboardStats, DashboardRecentOficio, Role } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviado',
  RECEIVED: 'Recibido',
  IN_PROCESS: 'En proceso',
  COMPLETED: 'Completado',
  ARCHIVED: 'Archivado',
};

const TYPE_LABELS: Record<string, string> = {
  INCOMING: 'Ingresado',
  OUTGOING: 'Enviado',
  INTERNAL_MEMO: 'Memo',
};

const QUICK_ACTIONS: {
  title: string;
  description: string;
  icon: typeof FileText;
  href: string;
  module: Module;
  color: string;
}[] = [
  {
    title: 'Oficios',
    description: 'Memos, CNI y Despacho',
    icon: FileText,
    href: '/oficios/internos',
    module: 'oficios',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    title: 'Equipos',
    description: 'Inventario de activos IT',
    icon: Monitor,
    href: '/equipment',
    module: 'equipment',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    title: 'Asignaciones',
    description: 'Entrega y devolución de equipos',
    icon: ClipboardList,
    href: '/assignments',
    module: 'assignments',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  {
    title: 'Compras',
    description: 'Solicitudes y adquisiciones',
    icon: ShoppingCart,
    href: '/purchases',
    module: 'purchases',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    title: 'Usuarios',
    description: 'Cuentas y roles del sistema',
    icon: Users,
    href: '/users',
    module: 'users',
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
  {
    title: 'Auditoría',
    description: 'Trazabilidad y registros',
    icon: ClipboardCheck,
    href: '/audit-records',
    module: 'audit-records',
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  {
    title: 'Ajustes',
    description: 'Configuración institucional',
    icon: Settings,
    href: '/settings',
    module: 'settings',
    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  },
];

interface DashboardContentProps {
  stats: DashboardStats;
  userName: string;
  role: Role;
  recentOficios: DashboardRecentOficio[];
}

export function DashboardContent({
  stats,
  userName,
  role,
  recentOficios,
}: DashboardContentProps) {
  const actions = QUICK_ACTIONS.filter((action) =>
    hasModuleAccess(role, action.module)
  );

  const statCards = [
    hasModuleAccess(role, 'oficios') && {
      key: 'oficios',
      title: 'Oficios',
      value: stats.totalOficios,
      subtitle: `${stats.inProcessOficios} en trámite`,
      icon: FileText,
      variant: 'primary' as const,
    },
    hasModuleAccess(role, 'equipment') && {
      key: 'equipment',
      title: 'Equipos',
      value: stats.totalEquipment,
      subtitle: `${stats.availableEquipment} disponibles`,
      icon: Monitor,
      variant: 'default' as const,
    },
    hasModuleAccess(role, 'assignments') && {
      key: 'assignments',
      title: 'Asignaciones',
      value: stats.activeAssignments,
      subtitle: 'Activas actualmente',
      icon: ClipboardList,
      variant: 'default' as const,
    },
    hasModuleAccess(role, 'purchases') && {
      key: 'purchases',
      title: 'Compras',
      value: stats.pendingPurchases,
      subtitle: 'Solicitudes pendientes',
      icon: ShoppingCart,
      variant: 'default' as const,
    },
    hasModuleAccess(role, 'users') && {
      key: 'users',
      title: 'Usuarios',
      value: stats.activeUsers,
      subtitle: 'Cuentas activas',
      icon: Users,
      variant: 'default' as const,
    },
  ].filter(Boolean) as {
    key: string;
    title: string;
    value: number;
    subtitle: string;
    icon: typeof FileText;
    variant: 'default' | 'primary';
  }[];

  const visibleStats = statCards.slice(0, 4);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title={`Hola, ${userName}`}
        description="Panel de control — Sistema de Gestión Empresarial"
      >
        {hasModuleAccess(role, 'oficios') && (
          <Button asChild>
            <Link href="/oficios/internos">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo oficio
            </Link>
          </Button>
        )}
      </PageHeader>

      {visibleStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {visibleStats.map((card) => (
            <StatsCard
              key={card.key}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              variant={card.variant}
            />
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Accesos rápidos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {actions.map((action) => (
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
        </section>
      )}

      {hasModuleAccess(role, 'oficios') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base font-heading">Oficios recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/oficios/internos">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {recentOficios.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aún no hay oficios registrados
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {recentOficios.map((oficio) => (
                  <Link
                    key={oficio.id}
                    href="/oficios/internos"
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 first:pt-0 last:pb-0 hover:bg-accent/30 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-muted-foreground">{oficio.number}</p>
                      <p className="text-sm font-medium line-clamp-1">{oficio.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {TYPE_LABELS[oficio.type] ?? oficio.type}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABELS[oficio.status] ?? oficio.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden md:inline">
                        {formatRelativeDate(oficio.createdAt.toISOString())}
                      </span>
                      <span className="text-xs text-muted-foreground hidden lg:inline">
                        {format(new Date(oficio.createdAt), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
