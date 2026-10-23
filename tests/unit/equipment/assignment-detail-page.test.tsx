import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentDetailView } from '@/components/equipment/assignments/AssignmentDetailView';
import { parseLegacyDeliveryNotes } from '@/components/equipment/assignments/utils';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('tab=active&page=2'),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/hooks/useAssignments', () => ({
  assignmentKeys: { detail: (id: string) => ['assignments', 'detail', id] },
  useAssignmentDetail: () => ({
    isLoading: false,
    isError: false,
    isForbidden: false,
    isNotFound: false,
    data: {
      assignment: {
        id: 'a1',
        equipmentId: 'eq1',
        employeeId: 'emp1',
        status: 'ACTIVE',
        assignedDate: '2026-01-01T10:00:00.000Z',
        returnedDate: null,
        deliveryReason: 'Nuevo ingreso',
        assignmentNotes: 'Condición de entrega: Bueno Accesorios: Cargador y mouse',
        notes: null,
        ramSnapshot: '16 GB',
        processorSnapshot: 'i7',
        storageSnapshot: '512 GB SSD',
        operatingSystemSnapshot: 'Windows 11',
        accessoriesSnapshot: 'Cargador',
        softwareSnapshot: 'Office',
        brandSnapshot: 'Dell',
        modelSnapshot: 'Latitude',
        inventoryNumberSnapshot: 'INV-001',
        serialNumberSnapshot: 'SN-999',
        employeeNameSnapshot: 'Ana Pérez',
        departmentSnapshot: 'TI',
        positionSnapshot: 'Analista',
        equipment: { category: 'LAPTOP' },
      },
      equipmentTimeline: { assignments: [], maintenances: [], history: [] },
    },
  }),
  useAssignments: () => ({
    returnAssignment: vi.fn(),
    isReturning: false,
    swapEquipment: vi.fn(),
    isSwapping: false,
    regenerateActa: vi.fn(),
    isRegeneratingActa: false,
    assignments: [],
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { role: 'ADMIN' } }),
}));

describe('parseLegacyDeliveryNotes', () => {
  it('separa condición y accesorios del formato antiguo', () => {
    const parsed = parseLegacyDeliveryNotes('Condición de entrega: Bueno Accesorios: Cargador y mouse');
    expect(parsed.condition).toBe('Bueno');
    expect(parsed.accessories).toBe('Cargador y mouse');
  });

  it('deja notas libres cuando no hay marcadores', () => {
    const parsed = parseLegacyDeliveryNotes('Observación general');
    expect(parsed.remainingNotes).toBe('Observación general');
    expect(parsed.condition).toBeNull();
  });
});

describe('AssignmentDetailView', () => {
  it('renderiza inventario, serie, specs y secciones de entrega', () => {
    render(<AssignmentDetailView assignmentId="a1" />);
    expect(screen.getByRole('heading', { name: 'INV-001' })).toBeTruthy();
    expect(document.body.textContent).toContain('SN-999');
    expect(screen.getByText('Dell Latitude')).toBeTruthy();
    const snapshots = screen.getByTestId('assignment-detail-snapshots');
    expect(snapshots).toBeTruthy();
    expect(snapshots.textContent).toContain('16 GB');
    expect(snapshots.textContent).toContain('Windows 11');
    const delivery = screen.getByTestId('assignment-delivery-section');
    expect(delivery.textContent).toContain('Bueno');
    expect(delivery.textContent).toContain('Cargador y mouse');
  });
});
