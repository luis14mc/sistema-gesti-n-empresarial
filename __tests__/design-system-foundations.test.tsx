import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';

describe('Phase 2A design-system foundations', () => {
  it('renders a semantic page header with breadcrumbs and actions', () => {
    render(<PageHeader title="Equipos" description="Gestión de activos" breadcrumbs={[{ label: 'Inicio', href: '/' }, { label: 'Equipos' }]} primaryAction={<Button>Nuevo equipo</Button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Equipos' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Migas de pan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo equipo' })).toBeInTheDocument();
  });

  it('uses centralized semantic status tones', () => {
    render(<StatusBadge tone="success">Activo</StatusBadge>);
    expect(screen.getByText('Activo')).toHaveAttribute('data-variant', 'outline');
    expect(screen.getByText('Activo')).toHaveClass('text-success');
  });

  it('announces loading without exposing decorative skeletons as content', () => {
    render(<LoadingState label="Cargando equipos" rows={2} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando equipos');
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
  });

  it('renders an actionable empty state', () => {
    const onCreate = vi.fn();
    render(<EmptyState title="No hay órdenes" description="Cree una nueva orden para comenzar." action={<Button onClick={onCreate}>Nueva orden</Button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva orden' }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('renders an accessible retryable error state with request reference', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="No fue posible consultar los datos." requestId="req-123" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Referencia: req-123');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
