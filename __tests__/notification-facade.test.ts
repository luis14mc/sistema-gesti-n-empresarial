import { beforeEach, describe, expect, it, vi } from 'vitest';

const fire = vi.fn();
const showLoading = vi.fn();
const close = vi.fn();

vi.mock('sweetalert2', () => ({
  default: {
    mixin: vi.fn(() => ({ fire })),
    showLoading,
    close,
  },
}));

describe('notification facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fire.mockResolvedValue({ isConfirmed: true });
  });

  it('routes success feedback through one provider', async () => {
    const { notification } = await import('@/platform/notifications');
    await notification.success({ title: 'Guardado', message: 'Los cambios se guardaron.' });
    expect(fire).toHaveBeenCalledOnce();
    expect(fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'Guardado', text: 'Los cambios se guardaron.' }));
  });

  it('returns a boolean confirmation result', async () => {
    const { notification } = await import('@/platform/notifications');
    await expect(notification.confirm({ title: 'Anular orden', message: 'Esta acción no se puede deshacer.' })).resolves.toBe(true);
    expect(fire).toHaveBeenCalledOnce();
  });

  it('returns one close function for loading feedback', async () => {
    const { notification } = await import('@/platform/notifications');
    const stop = notification.loading('Generando documento');
    stop();
    expect(fire).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
