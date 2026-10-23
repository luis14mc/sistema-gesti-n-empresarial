import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentsTable } from '@/components/equipment/assignments/AssignmentsTable';
import type { EquipmentAssignment } from '@/types';

const sample: EquipmentAssignment = {
  id: 'a1',
  equipmentId: 'eq1',
  status: 'ACTIVE',
  condition: null,
  assignedDate: '2026-01-15T00:00:00.000Z',
  returnedDate: null,
  departmentAtTime: 'TI',
  positionAtTime: 'Analista',
  employeeNameSnapshot: 'Ana Pérez',
  inventoryNumberSnapshot: 'IT-001',
  brandSnapshot: 'Dell',
  modelSnapshot: 'Latitude',
  serialNumberSnapshot: 'SN-1',
  notes: null,
  urlNotaPdf: null,
  equipment: {
    id: 'eq1',
    category: 'LAPTOP',
    type: 'LAPTOP',
    brand: 'Dell',
    model: 'Latitude',
    inventoryCode: 'IT-001',
  } as EquipmentAssignment['equipment'],
};

describe('AssignmentsTable', () => {
  it('renderiza 7 columnas cuando muestra devuelto', () => {
    render(
      <AssignmentsTable
        items={[sample]}
        showReturnedColumn
        sortBy="assignedDate"
        sortDir="desc"
        onSort={vi.fn()}
        onRowClick={vi.fn()}
        canCreate
        canUpdate
        onReturn={vi.fn()}
        onSwap={vi.fn()}
        onRegenerateActa={vi.fn()}
      />,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(7);
    expect(headers.map((h) => h.textContent)).toEqual(
      expect.arrayContaining(['Equipo', 'Estado', 'Acciones', expect.stringContaining('Devuelto')]),
    );
  });
});
