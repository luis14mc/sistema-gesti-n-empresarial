'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Monitor,
  Users,
  Contact,
  Settings,
  Menu,
  LogOut,
  ChevronLeft,
  ChevronDown,
  ClipboardList,
  ShoppingCart,
  ClipboardCheck,
  Loader2,
  Inbox,
  Building2,
  BarChart3,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { logoutAction } from '@/actions/auth';
import { hasModuleAccess, type Module } from '@/lib/permissions';
import { useBandejaContador } from '@/hooks/useBandejaContador';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { BRAND_APP_NAME } from '@/lib/brand';
import type { SessionUser, Role } from '@/types';

// ── NAV ITEMS ─────────────────────────────────────────────────

interface NavSubItem {
  label: string;
  href: string;
  /** Clave opcional para badge (ej: 'compras-bandeja'). */
  badgeKey?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  module: Module;
  children?: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    href: '/dashboard',                icon: LayoutDashboard, module: 'dashboard' },
  {
    label: 'Oficios',
    href: '/oficios/todos',
    icon: FileText,
    module: 'oficios',
    children: [
      { label: 'Todos los oficios',      href: '/oficios/todos' },
      { label: 'Internos / Memos',       href: '/oficios/internos' },
      { label: 'Externos CNI',           href: '/oficios/cni' },
      { label: 'Externos Despacho',      href: '/oficios/despacho' },
      { label: 'Importar oficios',       href: '/oficios/importar' },
    ],
  },
  {
    label: 'Equipos',
    href: '/equipment',
    icon: Monitor,
    module: 'equipment',
    children: [
      { label: 'Inventario', href: '/equipment' },
      { label: 'Dictámenes de baja', href: '/equipment-disposal' },
    ],
  },
  { label: 'Empleados',    href: '/employees',                icon: Contact,         module: 'employees' },
  { label: 'Asignaciones', href: '/assignments',              icon: ClipboardList,   module: 'assignments' },
  {
    label: 'Compras',
    href: '/compras/solicitudes',
    icon: ShoppingCart,
    module: 'purchases',
    children: [
      { label: 'Órdenes de compra',   href: '/compras/solicitudes' },
      { label: 'Nueva orden',         href: '/compras/nueva' },
      { label: 'Formato CNI',         href: '/compras/configuracion' },
      { label: 'Reportes',             href: '/compras/reportes' },
    ],
  },
  { label: 'Auditoría',    href: '/audit/logs',               icon: ClipboardCheck,  module: 'audit-records' },
  { label: 'Usuarios',     href: '/users',                    icon: Users,           module: 'users' },
  { label: 'Ajustes',      href: '/settings',                 icon: Settings,        module: 'settings' },
];

// ── SIDEBAR NAV ───────────────────────────────────────────────

function NavBadge({ badgeKey }: { badgeKey: string }) {
  const { data } = useBandejaContador(badgeKey);
  if (!data || data.count <= 0) return null;
  return (
    <span
      className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-none"
      aria-label={`${data.count} pendientes`}
    >
      {data.count > 99 ? '99+' : data.count}
    </span>
  );
}

function SidebarNav({
  role,
  collapsed,
  onNavClick,
}: {
  role: Role;
  collapsed: boolean;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const filteredItems = NAV_ITEMS.filter((item) =>
    hasModuleAccess(role, item.module)
  );

  // Expandir automáticamente el grupo cuando una subruta coincide.
  // Depende solo de `pathname` y `role` (no de `filteredItems`, que cambia
  // de referencia en cada render). Si no hay cambios reales, retorna `prev`
  // para no provocar un re-render y evitar un loop infinito.
  useEffect(() => {
    setExpandedMenus((prev) => {
      let changed = false;
      const next = { ...prev };

      NAV_ITEMS.forEach((item) => {
        if (!hasModuleAccess(role, item.module)) return;
        if (!item.children?.length) return;

        const isGroupActive = item.children.some(
          (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
        );

        if (isGroupActive && next[item.href] !== true) {
          next[item.href] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [pathname, role]);

  const toggleMenu = (href: string) => {
    setExpandedMenus((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <nav className="flex flex-col gap-1 px-3">
      {filteredItems.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const childrenActive = hasChildren
          ? item.children!.some(
              (child) => pathname === child.href || pathname.startsWith(child.href + '/')
            )
          : false;
        const selfActive = !hasChildren
          && (pathname === item.href || pathname.startsWith(item.href + '/'));
        const isParentActive = childrenActive;
        const isExpanded = hasChildren && (expandedMenus[item.href] ?? childrenActive);

        if (hasChildren && !collapsed) {
          return (
            <div key={item.href} className="flex flex-col gap-0.5">
              <div className="flex items-stretch gap-0.5">
                <Link
                  href={item.children![0].href}
                  onClick={onNavClick}
                  className={cn(
                    'flex flex-1 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isParentActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  title={item.label}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate flex-1 text-left">{item.label}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleMenu(item.href)}
                  aria-label={isExpanded ? `Contraer ${item.label}` : `Expandir ${item.label}`}
                  aria-expanded={isExpanded}
                  className={cn(
                    'flex items-center justify-center w-8 rounded-lg text-sm transition-colors',
                    isParentActive
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </button>
              </div>
              {isExpanded && (
                <div className="ml-4 flex flex-col gap-0.5 border-l border-border/60 pl-2">
                  {item.children!.map((child) => {
                    const isChildActive =
                      pathname === child.href || pathname.startsWith(child.href + '/');
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavClick}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                          isChildActive
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                      >
                        <span className="truncate flex-1">{child.label}</span>
                        {child.badgeKey && <NavBadge badgeKey={child.badgeKey} />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              selfActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            title={collapsed ? item.label : undefined}
            aria-current={selfActive ? 'page' : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

// ── LOADING SHELL ─────────────────────────────────────────────

function LoadingShell() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// ── MAIN LAYOUT ───────────────────────────────────────────────

interface MainLayoutProps {
  children: React.ReactNode;
  user?: SessionUser;
}

export default function MainLayout({ children, user: propUser }: MainLayoutProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, startLogout] = useTransition();

  // Retrocompatibilidad: si no se pasa user como prop,
  // lo obtenemos del endpoint /api/auth/me (lee cookie HttpOnly)
  const [fetchedUser, setFetchedUser] = useState<SessionUser | null>(null);
  const [isFetching, setIsFetching] = useState(!propUser);

  useEffect(() => {
    if (propUser) return;

    const abortController = new AbortController();

    fetch('/api/auth/me', { signal: abortController.signal })
      .then((r) => {
        if (!r.ok) throw new Error('No auth');
        return r.json();
      })
      .then((data) => {
        setFetchedUser(data.user);
        setIsFetching(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        router.push('/login');
      });

    return () => abortController.abort();
  }, [propUser, router]);

  const user = propUser ?? fetchedUser;

  if (isFetching && !user) return <LoadingShell />;
  if (!user) return <LoadingShell />;

  const userRole = user.role as Role;
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction();
      router.push('/login');
      router.refresh();
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ====== SIDEBAR DESKTOP ====== */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0 overflow-hidden">
          <BrandLogo height={collapsed ? 28 : 36} hideAlt={collapsed} className="shrink-0" />
          {!collapsed && (
            <span className="font-heading font-bold text-xs text-sidebar-foreground truncate leading-tight">
              {BRAND_APP_NAME}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav role={userRole} collapsed={collapsed} />
        </div>

        <div className="border-t border-sidebar-border p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-sidebar-foreground">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.role}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-full text-muted-foreground"
              aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
              <ChevronLeft
                className={cn(
                  'h-4 w-4 transition-transform',
                  collapsed && 'rotate-180'
                )}
              />
            </Button>
            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-full text-muted-foreground hover:text-destructive"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* ====== MAIN CONTENT ====== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-border bg-card shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex items-center gap-3 px-4 h-16 border-b border-border overflow-hidden">
                <BrandLogo height={36} className="shrink-0" />
                <span className="font-heading font-bold text-xs leading-tight">{BRAND_APP_NAME}</span>
              </div>
              <div className="py-4">
                <SidebarNav
                  role={userRole}
                  collapsed={false}
                  onNavClick={() => setMobileOpen(false)}
                />
              </div>
              <Separator />
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.role}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-3 justify-start text-destructive"
                  onClick={() => {
                    handleLogout();
                    setMobileOpen(false);
                  }}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{user.firstName}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
