'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Ticket,
  FileText,
  Monitor,
  Package,
  Clock,
  Users,
  Settings,
  Menu,
  LogOut,
  ChevronLeft,
  ClipboardList,
  ShoppingCart,
  ClipboardCheck,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { logoutAction } from '@/actions/auth';
import { hasModuleAccess, type Module } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { SessionUser, Role } from '@/types';

// ── NAV ITEMS ─────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  module: Module;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard',     icon: LayoutDashboard,  module: 'dashboard' },
  { label: 'Tickets',          href: '/tickets',       icon: Ticket,           module: 'tickets' },
  { label: 'Oficios',          href: '/oficios',       icon: FileText,         module: 'oficios' },
  { label: 'Equipos',          href: '/equipment',     icon: Monitor,          module: 'equipment' },
  { label: 'Inv. Promocional', href: '/inventory',     icon: Package,          module: 'inventory' },
  { label: 'Compras',          href: '/purchases',     icon: ShoppingCart,     module: 'purchases' },
  { label: 'Asistencia',       href: '/time-entries',  icon: Clock,            module: 'time-entries' },
  { label: 'Asignaciones',     href: '/assignments',   icon: ClipboardList,    module: 'assignments' },
  { label: 'Auditoría',        href: '/audit-records', icon: ClipboardCheck,   module: 'audit-records' },
  { label: 'Usuarios',         href: '/users',         icon: Users,            module: 'users' },
  { label: 'Ajustes',          href: '/settings',      icon: Settings,         module: 'settings' },
];

// ── SIDEBAR NAV ───────────────────────────────────────────────

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
  const filteredItems = NAV_ITEMS.filter((item) =>
    hasModuleAccess(role, item.module)
  );

  return (
    <nav className="flex flex-col gap-1 px-3">
      {filteredItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            title={collapsed ? item.label : undefined}
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
    let cancelled = false;
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) throw new Error('No auth');
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          setFetchedUser(data.user);
          setIsFetching(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          router.push('/login');
        }
      });
    return () => { cancelled = true; };
  }, [propUser, router]);

  const user = propUser ?? fetchedUser;

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
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">SG</span>
          </div>
          {!collapsed && (
            <span className="font-heading font-bold text-sm text-sidebar-foreground truncate">
              SGE
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
              <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
                <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">SG</span>
                </div>
                <span className="font-heading font-bold text-sm">SGE</span>
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
