import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentDetailSheet } from '@/components/equipment/assignments/AssignmentDetailSheet';

vi.mock('@/hooks/useAssignments', () => ({
  useAssignmentDetail: () => ({
    isLoading: false,
    isError: false,
    data: {
      assignment: {
        id: 'a1',
        equipmentId: 'eq1',
        employeeId: 'emp1',
        status: 'ACTIVE',
        assignedDate: '2026-01-01T00:00:00.000Z',
        returnedDate: null,
        ramSnapshot: '16 GB',
        processorSnapshot: 'i7',
        storageSnapshot: '512 GB SSD',
        operatingSystemSnapshot: 'Windows 11',
        accessoriesSnapshot: 'Cargador',
        softwareSnapshot: 'Office',
        notes: null,
        urlNotaPdf: null,
        condition: null,
        departmentAtTime: null,
        positionAtTime: null,
        employeeNameSnapshot: 'Ana',
      },
      equipmentTimeline: { assignments: [], maintenances: [], history: [] },
    },
  }),
}));

describe('AssignmentDetailSheet', () => {
  it('muestra snapshots del equipo entregado', () => {
    render(<AssignmentDetailSheet assignmentId="a1" open onOpenChange={() => {}} />);
    expect(screen.getByTestId('assignment-detail-snapshots')).toBeTruthy();
    expect(screen.getByText('16 GB')).toBeTruthy();
    expect(screen.getByText('Windows 11')).toBeTruthy();
  });
});
