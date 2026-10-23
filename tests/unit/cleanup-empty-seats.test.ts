import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();
const updateMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    softwareLicenseSeat: {
      findMany: (...args: unknown[]) => findMany(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}));

describe('cleanupEmptySeats', () => {
  beforeEach(() => {
    findMany.mockReset();
    updateMany.mockReset();
    findMany.mockResolvedValue([
      { id: 'empty-1', subscription: { product: { name: 'X' } }, seatType: 'INDIVIDUAL' },
    ]);
  });

  it('dry-run no modifica nada', async () => {
    const { cleanupEmptySeats } = await import('@/modules/software-licenses/application/cleanup-empty-seats');
    const result = await cleanupEmptySeats(false);
    expect(result.dryRun).toBe(true);
    expect(result.candidates).toEqual(['empty-1']);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
