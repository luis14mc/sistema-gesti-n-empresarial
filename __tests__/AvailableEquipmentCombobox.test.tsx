import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AvailableEquipmentCombobox } from '@/components/equipment/AvailableEquipmentCombobox';
import type { Equipment } from '@/types';

const useEquipmentMock = vi.fn();

vi.mock('@/hooks/useEquipment', () => ({
  useEquipment: (...args: unknown[]) => useEquipmentMock(...args),
}));

const sampleEquipment: Equipment = {
  id: 'eq-1',
  code: 'TI-LAP-0001',
  inventoryCode: 'TI-LAP-0001',
  name: 'Dell Latitude',
  type: 'LAPTOP',
  brand: 'Dell',
  model: 'Latitude 5440',
  serialNumber: 'SN-ABC',
  status: 'AVAILABLE',
  description: null,
  purchaseDate: null,
  purchaseCost: null,
  warrantyDate: null,
  depreciationDate: null,
  ram: '16 GB',
  processor: 'i7',
  storage: '512 GB',
  os: 'Windows 11',
  includedAccessories: null,
  installedSoftware: null,
  retirementReason: null,
  retiredAt: null,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AvailableEquipmentCombobox', () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    Element.prototype.scrollIntoView = vi.fn();

    useEquipmentMock.mockReturnValue({
      equipment: [sampleEquipment],
      isLoading: false,
      isError: false,
    });
  });

  it('requests available equipment with debounced search and pageSize 50', async () => {
    const onChange = vi.fn();
    render(
      <AvailableEquipmentCombobox
        value={null}
        onChange={onChange}
        enabled
      />,
    );

    expect(useEquipmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'AVAILABLE',
        pageSize: 50,
        page: 1,
      }),
      expect.objectContaining({ enabled: true, notifyOnError: true }),
    );

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByPlaceholderText(/Buscar por inventario/i), {
      target: { value: 'latitude' },
    });

    await waitFor(
      () => {
        expect(useEquipmentMock).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'latitude' }),
          expect.any(Object),
        );
      },
      { timeout: 500 },
    );
  });

  it('selects equipment and keeps the full object via onChange', async () => {
    const onChange = vi.fn();
    render(
      <AvailableEquipmentCombobox
        value={null}
        onChange={onChange}
        enabled
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText(/TI-LAP-0001/));

    expect(onChange).toHaveBeenCalledWith(sampleEquipment);
  });
});
