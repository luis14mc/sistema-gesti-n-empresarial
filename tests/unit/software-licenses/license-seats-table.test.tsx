import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SeatAssignEmployeeDialog } from '@/components/software-licenses/AssignLicenseDialog';
import { LicenseSeatsTable, type LicenseSeatRow } from '@/components/software-licenses/LicenseSeatsTable';

vi.mock('@/components/equipment/assignments/ActiveEmployeeCombobox', () => ({
  ActiveEmployeeCombobox: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (id: string) => void;
  }) => (
    <input
      data-testid="employee-combobox-input"
      aria-label="Empleado"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const seats: LicenseSeatRow[] = [
  {
    id: 'seat-a',
    accountEmail: 'a@test.com',
    seatType: 'INDIVIDUAL',
    effectiveStatus: 'AVAILABLE',
    status: 'AVAILABLE',
    assignments: [],
  },
  {
    id: 'seat-b',
    accountEmail: null,
    seatType: 'INDIVIDUAL',
    effectiveStatus: 'AVAILABLE',
    status: 'AVAILABLE',
    assignments: [],
  },
];

describe('LicenseSeatsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza inputs de búsqueda en filas de la tabla', () => {
    render(<LicenseSeatsTable seats={seats} canUpdate onChange={async () => {}} />);
    const table = screen.getByTestId('license-seats-table');
    expect(within(table).queryByPlaceholderText('Asignar empleado')).toBeNull();
    expect(within(table).queryByRole('textbox')).toBeNull();
  });

  it('muestra badge Sin correo — completar cuando falta correo', () => {
    render(<LicenseSeatsTable seats={seats} canUpdate onChange={async () => {}} />);
    expect(screen.getByText('Sin correo — completar')).toBeTruthy();
    expect(screen.getByText('a@test.com')).toBeTruthy();
  });

});

describe('SeatAssignEmployeeDialog', () => {
  it('reinicia el combobox al abrir para otro asiento', () => {
    const { rerender } = render(
      <SeatAssignEmployeeDialog
        open
        onOpenChange={() => {}}
        seatId="seat-a"
        seatLabel="Cuenta A"
        mode="assign"
      />,
    );

    const inputA = screen.getByTestId('employee-combobox-input') as HTMLInputElement;
    fireEvent.change(inputA, { target: { value: 'emp-a' } });
    expect(inputA.value).toBe('emp-a');

    rerender(
      <SeatAssignEmployeeDialog
        open={false}
        onOpenChange={() => {}}
        seatId="seat-a"
        seatLabel="Cuenta A"
        mode="assign"
      />,
    );

    rerender(
      <SeatAssignEmployeeDialog
        open
        onOpenChange={() => {}}
        seatId="seat-b"
        seatLabel="Cuenta B"
        mode="assign"
      />,
    );

    const inputB = screen.getByTestId('employee-combobox-input') as HTMLInputElement;
    expect(inputB.value).toBe('');
  });
});
