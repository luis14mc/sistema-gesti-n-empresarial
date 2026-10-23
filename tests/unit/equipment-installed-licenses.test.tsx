import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EquipmentInstalledLicenses } from '@/components/software-licenses/EquipmentInstalledLicenses';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/utils/api', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: vi.fn(),
  },
}));

describe('EquipmentInstalledLicenses', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it('lista licencias DEVICE del equipo con producto y clave enmascarada', async () => {
    get.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: 'seat-1',
              licenseKey: '•••••ABCDE',
              licenseKeyPresent: true,
              effectiveStatus: 'ASSIGNED',
              subscription: { id: 'sub-1', product: { name: 'Windows 11' }, planName: 'Pro' },
            },
          ],
        },
      },
    });

    render(<EquipmentInstalledLicenses equipmentId="eq-1" canRead canUpdate={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('equipment-installed-licenses')).toBeTruthy();
    });
    expect(screen.getByText('Windows 11')).toBeTruthy();
    expect(screen.getByText('Pro')).toBeTruthy();
    expect(screen.getByText('•••••ABCDE')).toBeTruthy();
    expect(screen.getByText('En uso')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/api/software-licenses/equipment/eq-1');
  });
});
