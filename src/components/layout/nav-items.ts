import {
  LayoutDashboard,
  FileText,
  Monitor,
  Contact,
  Settings,
  ShoppingCart,
  ClipboardCheck,
} from 'lucide-react';
import type { Module } from '@/lib/permissions';

// ── NAV MODEL ─────────────────────────────────────────────────
//
// Phase 14A — Institutional navigation (target information architecture).
// This list is the single source of truth for the sidebar and is covered by
// tests/contracts/navigation-reconciliation.test.ts. Every entry must be an
// ACTIVE module whose href resolves to a real, operational page.
//
// Groups follow the institutional IA (Phase 14 §6):
//   Inicio · Correspondencia · Activos · Compras · Personas · Control ·
//   Administración
//
// A child may declare its OWN `module` (falling back to the parent's) so a
// section can group items with different permission requirements. A group is
// hidden entirely when the current role can see none of its children.
//
// Deliberately EXCLUDED (foundation-only / not enabled for the initial internal
// release — do not add without a product decision + permission entitlement):
//   • Notifications        (no UI/email backend — FOUNDATION_ONLY)
//   • Integrations         (no adapters/consumers — FOUNDATION_ONLY)
//   • Organization/Platform admin (TECHNICAL_ADMIN_ONLY / FUTURE — no UI)
//   • Maintenance (/maintenance) (no operational page yet — 14F).
//
// Institutional Audits (/audits) is EXPOSED (Phase 14F) under Control, gated by
// the `audits` permission module (ADMIN).

export interface NavSubItem {
  label: string;
  href: string;
  /** Overrides the parent module for per-child permission filtering. */
  module?: Module;
  /** Optional key for a pending-count badge (e.g. 'compras-bandeja'). */
  badgeKey?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Representative module; used for leaf items and as a child fallback. */
  module: Module;
  children?: NavSubItem[];
}

export const NAV_ITEMS: NavItem[] = [
  // Inicio
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },

  // Correspondencia
  {
    label: 'Correspondencia',
    href: '/oficios/todos',
    icon: FileText,
    module: 'oficios',
    children: [
      { label: 'Todos los oficios', href: '/oficios/todos' },
      { label: 'Oficios internos', href: '/oficios/internos' },
      { label: 'Oficios CNI', href: '/oficios/cni' },
      { label: 'Oficios Despacho', href: '/oficios/despacho' },
      { label: 'Importar oficios', href: '/oficios/importar' },
    ],
  },

  // Activos
  {
    label: 'Activos',
    href: '/equipment',
    icon: Monitor,
    module: 'equipment',
    children: [
      { label: 'Equipos', href: '/equipment', module: 'equipment' },
      { label: 'Asignaciones', href: '/assignments', module: 'assignments' },
      { label: 'Baja de equipos', href: '/equipment-disposal', module: 'equipment' },
    ],
  },

  // Compras
  {
    label: 'Compras',
    href: '/compras/solicitudes',
    icon: ShoppingCart,
    module: 'purchases',
    children: [
      { label: 'Órdenes de compra', href: '/compras/solicitudes' },
      { label: 'Nueva orden', href: '/compras/nueva' },
      { label: 'Proveedores', href: '/compras/proveedores' },
      { label: 'Formato CNI', href: '/compras/configuracion' },
      { label: 'Reportes', href: '/compras/reportes' },
    ],
  },

  // Personas
  {
    label: 'Personas',
    href: '/employees',
    icon: Contact,
    module: 'employees',
    children: [
      { label: 'Empleados', href: '/employees', module: 'employees' },
      { label: 'Usuarios', href: '/users', module: 'users' },
    ],
  },

  // Control
  {
    label: 'Control',
    href: '/audits',
    icon: ClipboardCheck,
    module: 'audits',
    children: [
      { label: 'Auditoría institucional', href: '/audits', module: 'audits' },
      { label: 'Auditoría del sistema', href: '/audit/logs', module: 'audit-records' },
    ],
  },

  // Administración
  {
    label: 'Administración',
    href: '/settings',
    icon: Settings,
    module: 'settings',
    children: [{ label: 'Configuración', href: '/settings', module: 'settings' }],
  },
];
