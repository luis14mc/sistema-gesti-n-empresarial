import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AuthPageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Contenedor visual compartido para pantallas de autenticación.
 * Fondos decorativos excluidos del árbol de accesibilidad.
 */
export function AuthPageShell({ children, className }: AuthPageShellProps) {
  return (
    <main
      id="main-content"
      className={cn(
        'relative min-h-screen flex items-center justify-center bg-background p-4 sm:p-6',
        className
      )}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-blue/8 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(99%_0.01_260/0.4),transparent_55%)]" />
      </div>
      {children}
    </main>
  );
}

export function AuthFormFallback({ message }: { message: string }) {
  return (
    <AuthPageShell>
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col items-center gap-3"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none motion-reduce:border-primary"
          aria-hidden="true"
        />
        <span className="sr-only">{message}</span>
      </div>
    </AuthPageShell>
  );
}
