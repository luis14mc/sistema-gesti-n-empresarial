'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { periodFromPayMonth } from '@/modules/payroll/domain';

/** Institutional CNI / payroll accent */
export const PAYROLL_BRAND = '#233981';

const NAV_ITEMS = [
  { label: 'Boletas', href: '/planilla', match: (path: string) => path === '/planilla' },
  { label: 'Histórico', href: '/planilla/historico', match: (path: string) => path.startsWith('/planilla/historico') },
  { label: 'Personal', href: '/planilla/empleados', match: (path: string) => path.startsWith('/planilla/empleados') },
  {
    label: 'Configuración',
    href: '/planilla/configuracion',
    match: (path: string) => path.startsWith('/planilla/configuracion'),
  },
] as const;

export function planillaBreadcrumbs(current: string) {
  return [{ label: 'Planilla', href: '/planilla' }, { label: current }];
}

export function formatPayrollPeriodLabel(payMonth: string): string {
  try {
    const period = periodFromPayMonth(payMonth);
    const fmt = (d: Date) =>
      d.toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(period.start)} – ${fmt(period.end)}`;
  } catch {
    return '';
  }
}

export function PayrollChrome({ children }: { children?: ReactNode }) {
  const pathname = usePathname() ?? '';

  return (
    <div className="space-y-6">
      <nav
        aria-label="Secciones de planilla"
        className="border-b border-border/80"
        style={{ boxShadow: `inset 0 -2px 0 0 ${PAYROLL_BRAND}22` }}
      >
        <ul className="-mb-px flex flex-wrap gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'inline-flex items-center border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'border-[#233981] text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </div>
  );
}
