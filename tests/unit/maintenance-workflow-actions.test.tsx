import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MaintenanceWorkflowActions } from '@/components/equipment/MaintenanceWorkflowActions';

vi.mock('@/lib/swal', () => ({
  swalConfirm: vi.fn(async () => ({ isConfirmed: false })),
}));

describe('MaintenanceWorkflowActions', () => {
  it('no muestra acciones para COMPLETED ni CANCELLED', () => {
    const onStatusChange = vi.fn();
    const { rerender } = render(
      <MaintenanceWorkflowActions
        maintenanceId="m-1"
        status="COMPLETED"
        onStatusChange={onStatusChange}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Iniciar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Completar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();

    rerender(
      <MaintenanceWorkflowActions
        maintenanceId="m-1"
        status="CANCELLED"
        onStatusChange={onStatusChange}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  it('muestra Iniciar y Cancelar en SCHEDULED', () => {
    render(
      <MaintenanceWorkflowActions
        maintenanceId="m-1"
        status="SCHEDULED"
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Completar' })).toBeNull();
  });
});
