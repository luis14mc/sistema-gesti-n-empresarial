import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DisposalDeviceLicenseNotice } from '@/components/software-licenses/DisposalDeviceLicenseNotice';

const get = vi.fn();

vi.mock('@/utils/api', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
  },
}));

describe('DisposalDeviceLicenseNotice', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('no muestra aviso cuando visible es false', () => {
    render(<DisposalDeviceLicenseNotice equipmentId="eq-1" visible={false} />);
    expect(screen.queryByTestId('disposal-device-license-notice')).toBeNull();
  });

  it('muestra aviso con productos cuando N>0', async () => {
    get.mockResolvedValue({
      data: {
        data: {
          items: [
            { id: 's1', subscription: { product: { name: 'Adobe CC' }, planName: 'Teams' } },
            { id: 's2', subscription: { product: { name: 'AutoCAD' }, planName: 'Standard' } },
          ],
        },
      },
    });

    render(<DisposalDeviceLicenseNotice equipmentId="eq-9" visible />);

    await waitFor(() => {
      expect(screen.getByTestId('disposal-device-license-notice')).toBeTruthy();
    });
    expect(screen.getByText(/2 licencias instaladas/)).toBeTruthy();
    expect(screen.getByText(/Adobe CC · Teams/)).toBeTruthy();
    expect(screen.getByText(/AutoCAD · Standard/)).toBeTruthy();
  });
});
